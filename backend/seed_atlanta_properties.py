"""
Seed 6 Atlanta properties for testing
"""
from app.database import SessionLocal
from app.models.property import Property
from app.models.user import User
from datetime import datetime
import uuid

db = SessionLocal()

# Get or create a test user
test_user = db.query(User).filter(User.email == "test@example.com").first()
if not test_user:
    test_user_id = str(uuid.uuid4())
    test_user = User(
        id=test_user_id,
        email="test@example.com",
        hashed_password="test_hash",
        full_name="Test User",
        is_active=True
    )
    db.add(test_user)
    db.commit()
else:
    test_user_id = test_user.id
    print(f"Using existing user: {test_user.email}")

# Create 6 Atlanta properties
properties = [
    {
        "user_id": test_user_id,
        "deal_name": "Piedmont Tower Apartments",
        "property_address": "1234 Piedmont Ave NE, Atlanta, GA 30309",
        "submarket": "Midtown",
        "property_type": "Multifamily",
        "total_units": 250,
        "total_residential_sf": 225000,
        "year_built": 2010,
    },
    {
        "user_id": test_user_id,
        "deal_name": "Buckhead Place Residences",
        "property_address": "5678 Peachtree Rd NE, Atlanta, GA 30326",
        "submarket": "Buckhead",
        "property_type": "Multifamily",
        "total_units": 180,
        "total_residential_sf": 165000,
        "year_built": 2015,
    },
    {
        "user_id": test_user_id,
        "deal_name": "Central Perimeter Commons",
        "property_address": "9012 Ashford Dunwoody Rd, Atlanta, GA 30338",
        "submarket": "Central Perimeter",
        "property_type": "Multifamily",
        "total_units": 345,
        "total_residential_sf": 310500,
        "year_built": 2008,
    },
    {
        "user_id": test_user_id,
        "deal_name": "Brookhaven Station Apartments",
        "property_address": "3456 Dresden Dr NE, Atlanta, GA 30319",
        "submarket": "Brookhaven",
        "property_type": "Multifamily",
        "total_units": 290,
        "total_residential_sf": 260000,
        "year_built": 2012,
    },
    {
        "user_id": test_user_id,
        "deal_name": "Old Fourth Ward Lofts",
        "property_address": "789 Boulevard NE, Atlanta, GA 30312",
        "submarket": "Old Fourth Ward",
        "property_type": "Multifamily",
        "total_units": 120,
        "total_residential_sf": 135000,
        "year_built": 2018,
    },
    {
        "user_id": test_user_id,
        "deal_name": "Decatur Heights Apartments",
        "property_address": "2345 E College Ave, Decatur, GA 30030",
        "submarket": "Decatur",
        "property_type": "Multifamily",
        "total_units": 200,
        "total_residential_sf": 180000,
        "year_built": 2014,
    }
]

for prop_data in properties:
    prop = Property(**prop_data)
    db.add(prop)

db.commit()

# Verify
count = db.query(Property).count()
print(f"Created {count} properties")

for p in db.query(Property).all():
    print(f"  - {p.deal_name} ({p.submarket})")

db.close()
