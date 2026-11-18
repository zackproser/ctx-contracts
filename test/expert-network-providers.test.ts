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

  it('says which networks send from subdomains of their registered domain: Office Hours only', () => {
    const list = (vocabulary as Record<string, unknown>).EXPERT_NETWORK_SUBDOMAIN_SENDERS;
    expect(list).toEqual(['officehours']);
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
    expect(resolve('thirdbridge.com')).toBe('thirdbridge');
    // A subdomain is the network only where the network is known to send from one.
    expect(resolve('mail.colemanrg.com')).toBeNull();
    expect(resolve('mail.thirdbridge.com')).toBeNull();
    expect(resolve('mail.alphasights.com')).toBeNull();
    // Nothing that merely ends the same way, and nothing that is not a domain.
    expect(resolve('notofficehours.com')).toBeNull();
    expect(resolve('officehours.com.evil.example')).toBeNull();
    expect(resolve('evil-thirdbridge.com')).toBeNull();
    expect(resolve('')).toBeNull();
  });

  it.each(['officehours', 'coleman', 'thirdbridge'])('classifies a %s case under the one task family', (provider) => {
    expect(ExpertCallTaskMetadataSchema.parse({ task_type: EXPERT_CALL_TASK.id, provider }))
      .toEqual({ task_type: 'expert_consultation', provider });
    expect(() => ExpertCallTaskMetadataSchema.parse({ task_type: EXPERT_CALL_TASK.id, provider, authorized: true })).toThrow();
  });
});
