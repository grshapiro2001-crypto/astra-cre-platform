/**
 * Regression test for PR #155 crash: the three v2 Assumptions sections
 * (Renovation, Retail, Tax Abatement) read state.<module>.<field> without
 * null-guarding, so when the reducer state is missing those slices (e.g.
 * loading a model saved before PR #155) the components threw TypeError on
 * first render and triggered the global error boundary.
 *
 * These smoke tests mount each section with no props (i.e. inputs=undefined)
 * and confirm rendering does not throw.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RenovationSection } from '../RenovationSection';
import { RetailSection } from '../RetailSection';
import { TaxAbatementSection } from '../TaxAbatementSection';

describe('v2 Assumptions sections — undefined-state smoke tests', () => {
  it('RenovationSection does not crash on undefined input', () => {
    expect(() => render(<RenovationSection />)).not.toThrow();
  });

  it('RetailSection does not crash on undefined input', () => {
    expect(() => render(<RetailSection />)).not.toThrow();
  });

  it('TaxAbatementSection does not crash on undefined input', () => {
    expect(() => render(<TaxAbatementSection />)).not.toThrow();
  });
});
