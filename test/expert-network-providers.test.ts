import { describe, expect, it } from 'vitest';
import { ExpertCallTaskMetadataSchema } from '../src/envelopes.js';
import * as vocabulary from '../src/vocabulary.js';
import {
  EXPERT_CALL_TASK, EXPERT_NETWORK_DOMAINS, EXPERT_NETWORK_LABELS, EXPERT_NETWORK_PROVIDERS,
} from '../src/vocabulary.js';

// Office Hours, Coleman and Third Bridge join the four networks CTX already
// files cases for. A provider in this list can be persisted as a case; being
// listed never grants authority to submit a form or send anything.
describe('expert network vocabulary', () => {
  it('names seven networks: the original four first, in their order, then the three added', () => {
    expect([...EXPERT_NETWORK_PROVIDERS]).toEqual(
      ['alphasights', 'glg', 'tegus', 'guidepoint', 'officehours', 'coleman', 'thirdbridge']);
  });

  it('labels the added networks as the owner reads them', () => {
    expect(EXPERT_NETWORK_LABELS).toMatchObject({ officehours: 'Office Hours', coleman: 'Coleman', thirdbridge: 'Third Bridge' });
  });

  it('gives each added network its registered sender domain', () => {
    expect(EXPERT_NETWORK_DOMAINS).toMatchObject({
      officehours: ['officehours.com'], coleman: ['colemanrg.com'], thirdbridge: ['thirdbridge.com'],
    });
  });

  it('keeps the four original networks exactly as they were', () => {
    expect(EXPERT_NETWORK_LABELS).toMatchObject({ alphasights: 'AlphaSights', glg: 'GLG', tegus: 'Tegus', guidepoint: 'Guidepoint' });
    expect(EXPERT_NETWORK_DOMAINS).toMatchObject({
      alphasights: ['alphasights.com'], glg: ['glgroup.com', 'glg.it'],
      tegus: ['tegus.com'], guidepoint: ['guidepointglobal.com', 'guidepoint.com'],
    });
  });

  it('has a label and at least one lowercase domain for every network, and no domain claimed twice', () => {
    const seen = new Map<string, string>();
    for (const provider of EXPERT_NETWORK_PROVIDERS) {
      expect(EXPERT_NETWORK_LABELS[provider], provider).toBeTruthy();
      expect(EXPERT_NETWORK_DOMAINS[provider].length, provider).toBeGreaterThan(0);
      for (const domain of EXPERT_NETWORK_DOMAINS[provider]) {
        expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
        expect(seen.get(domain), `${domain} is listed for two networks`).toBeUndefined();
        seen.set(domain, provider);
      }
    }
    expect(Object.keys(EXPERT_NETWORK_LABELS).sort()).toEqual([...EXPERT_NETWORK_PROVIDERS].sort());
    expect(Object.keys(EXPERT_NETWORK_DOMAINS).sort()).toEqual([...EXPERT_NETWORK_PROVIDERS].sort());
  });

  it('says which networks send from subdomains of their registered domain: Office Hours and Coleman', () => {
    const list = (vocabulary as Record<string, unknown>).EXPERT_NETWORK_SUBDOMAIN_SENDERS;
    // Coleman's invitation of Nov 17, 2026 came from rng@outreach.colemanrg.com (its mail system rewrites
    // the From onto that subdomain and puts the person's own address in Reply-To).
    expect(list).toEqual(['officehours', 'coleman']);
  });

  it('resolves a sender domain to its network: exact for every network, a subdomain only where the network sends from one', () => {
    const resolve = (vocabulary as Record<string, unknown>).expertNetworkForSenderDomain as (domain: string) => string | null;
    expect(typeof resolve).toBe('function');
    expect(resolve('alphasights.com')).toBe('alphasights');
    expect(resolve('GLGROUP.com')).toBe('glg');
    expect(resolve('guidepoint.com')).toBe('guidepoint');
    expect(resolve('tegus.com')).toBe('tegus');
    expect(resolve('officehours.com')).toBe('officehours');
    expect(resolve('onboarding.officehours.com')).toBe('officehours');
    expect(resolve('colemanrg.com')).toBe('coleman');
    expect(resolve('outreach.colemanrg.com')).toBe('coleman');
    expect(resolve(' OUTREACH.ColemanRG.com ')).toBe('coleman');
    expect(resolve('mail.outreach.colemanrg.com')).toBe('coleman');
    expect(resolve('thirdbridge.com')).toBe('thirdbridge');
    // A subdomain is the network only where the network is known to send from one.
    expect(resolve('mail.thirdbridge.com')).toBeNull();
    expect(resolve('mail.alphasights.com')).toBeNull();
    // Nothing that merely ends the same way, and nothing that is not a domain.
    expect(resolve('notofficehours.com')).toBeNull();
    expect(resolve('officehours.com.evil.example')).toBeNull();
    expect(resolve('evil-thirdbridge.com')).toBeNull();
    expect(resolve('')).toBeNull();
  });

  it('never takes a look-alike for a subdomain sender: only a real subdomain of the registered domain counts', () => {
    const resolve = (vocabulary as Record<string, unknown>).expertNetworkForSenderDomain as (domain: string) => string | null;
    for (const domain of [
      // Ends with the registered domain without being under it, or has it in the middle.
      'colemanrg.com.evil.test', 'outreach.colemanrg.com.evil.test', 'evilcolemanrg.com', 'evil-colemanrg.com',
      'notofficehours.com', 'officehours.com.evil.example', 'xofficehours.com',
      // Near misses and Coleman's link-only domain, which no Coleman mail is sent from.
      'colemanrg.co', 'colemanrg.com.', 'colemanerm.com', 'experts.coleman.colemanerm.com',
      // Not a domain at all: an empty, damaged or padded label, or an address.
      '.colemanrg.com', 'outreach..colemanrg.com', '-outreach.colemanrg.com', 'outreach-.colemanrg.com',
      'out reach.colemanrg.com', 'out_reach.colemanrg.com', 'evil.test@outreach.colemanrg.com', 'rng@colemanrg.com',
      '.officehours.com', 'evil.test@onboarding.officehours.com',
    ]) expect(resolve(domain), domain).toBeNull();
  });

  it.each(['officehours', 'coleman', 'thirdbridge'])('classifies a %s case under the one task family', (provider) => {
    expect(ExpertCallTaskMetadataSchema.parse({ task_type: EXPERT_CALL_TASK.id, provider }))
      .toEqual({ task_type: 'expert_consultation', provider });
    expect(() => ExpertCallTaskMetadataSchema.parse({ task_type: EXPERT_CALL_TASK.id, provider, authorized: true })).toThrow();
  });
});
