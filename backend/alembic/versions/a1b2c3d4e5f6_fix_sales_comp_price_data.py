"""Fix sales comp price data — correct misplaced price_per_sf values in sale_price column

The original extraction mapped Price/SF values (e.g. $264.19) into the sale_price
field instead of price_per_sf.  price_per_unit was never properly calculated.

This migration:
1. Moves the current sale_price → price_per_sf (where it's clearly a $/SF value)
2. Derives the correct total sale_price from: price_per_sf × avg_unit_sf × units
3. Calculates price_per_unit = sale_price / units

For comps without avg_unit_sf, uses 900 SF as a reasonable multifamily default.

Revision ID: a1b2c3d4e5f6
Revises: 3bac34cba4f5
Create Date: 2026-02-10 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3bac34cba4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Reasonable default avg unit SF for multifamily when not available
DEFAULT_AVG_UNIT_SF = 900.0


def upgrade() -> None:
    # Use a raw connection so we can run SELECT + UPDATE in a transaction
    conn = op.get_bind()

    # ---------------------------------------------------------------
    # Step 1: Identify comps where sale_price is actually price_per_sf
    #         (sale_price < 10,000 AND units > 10)
    # ---------------------------------------------------------------
    rows = conn.execute(
        sa.text(
            """
            SELECT id, sale_price, units, avg_unit_sf, price_per_sf, price_per_unit
            FROM sales_comps
            WHERE sale_price IS NOT NULL
              AND sale_price < 10000
              AND units IS NOT NULL
              AND units > 10
            """
        )
    ).fetchall()

    if not rows:
        # No corrupted data found — nothing to fix
        return

    for row in rows:
        comp_id = row[0]
        current_sale_price = row[1]  # This is actually $/SF
        units = row[2]
        avg_unit_sf = row[3]
        existing_psf = row[4]

        # Use existing avg_unit_sf or fall back to default
        effective_sf = avg_unit_sf if avg_unit_sf and avg_unit_sf > 0 else DEFAULT_AVG_UNIT_SF

        # Correct values
        correct_price_per_sf = current_sale_price
        correct_sale_price = round(current_sale_price * effective_sf * units, 2)
        correct_price_per_unit = round(correct_sale_price / units, 2) if units > 0 else None

        conn.execute(
            sa.text(
                """
                UPDATE sales_comps
                SET sale_price = :sale_price,
                    price_per_sf = :price_per_sf,
                    price_per_unit = :price_per_unit
                WHERE id = :id
                """
            ),
            {
                "id": comp_id,
                "sale_price": correct_sale_price,
                "price_per_sf": correct_price_per_sf,
                "price_per_unit": correct_price_per_unit,
            },
        )

    # ---------------------------------------------------------------
    # Step 2: For any remaining comps with sale_price > 10,000 that
    #         still have NULL or nonsensical price_per_unit, derive it.
    # ---------------------------------------------------------------
    conn.execute(
        sa.text(
            """
            UPDATE sales_comps
            SET price_per_unit = ROUND(sale_price / units, 2)
            WHERE sale_price IS NOT NULL
              AND sale_price > 100000
              AND units IS NOT NULL
              AND units > 0
              AND (price_per_unit IS NULL OR price_per_unit < 1000)
            """
        )
    )

    # ---------------------------------------------------------------
    # Step 3: Derive price_per_sf where missing but derivable
    # ---------------------------------------------------------------
    conn.execute(
        sa.text(
            """
            UPDATE sales_comps
            SET price_per_sf = ROUND(sale_price / (units * avg_unit_sf), 2)
            WHERE price_per_sf IS NULL
              AND sale_price IS NOT NULL
              AND sale_price > 100000
              AND units IS NOT NULL
              AND units > 0
              AND avg_unit_sf IS NOT NULL
              AND avg_unit_sf > 0
            """
        )
    )


def downgrade() -> None:
    # Downgrade is destructive — we cannot fully reverse the data fix.
    # We store the original $/SF value in price_per_sf, so it's preserved.
    # To "undo", move price_per_sf back to sale_price and null out derived fields.
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE sales_comps
            SET sale_price = price_per_sf,
                price_per_unit = NULL
            WHERE price_per_sf IS NOT NULL
              AND price_per_sf < 10000
            """
        )
    )
