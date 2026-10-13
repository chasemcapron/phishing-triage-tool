import { describe, expect, it } from 'vitest'
import { findLookalike } from '../src/engine/checks/lookalike'

describe('findLookalike', () => {
  it.each([
    ['micros0ft.example', 'homoglyph', 'Microsoft'],
    ['rnicrosoft.example', 'homoglyph', 'Microsoft'],
    ['paypa1.example', 'homoglyph', 'PayPal'],
    ['g00gle.example', 'homoglyph', 'Google'],
    ['xn--pple-43d.example', 'homoglyph', 'Apple'], // Cyrillic "а"
    ['xn--80ak6aa92e.example', 'homoglyph', 'Apple'], // all-Cyrillic "аррӏе"
    ['paypall.example', 'typo', 'PayPal'],
    ['amazn.example', 'typo', 'Amazon'],
    ['microsfot.example', 'typo', 'Microsoft'],
    ['paypal-secure-login.example', 'combosquat', 'PayPal'],
    ['ezpass-tollpay-services.test', 'combosquat', 'E-ZPass'],
    ['netflixbilling.example', 'combosquat', 'Netflix'],
    ['paypal.com.account-verify.example', 'brand-subdomain', 'PayPal'],
    ['usps.com-redelivery.test', 'brand-subdomain', 'USPS'],
    ['login.chase.secure-banking.example', 'brand-subdomain', 'Chase'],
    ['google.test', 'brand-tld', 'Google'],
  ])('%s → %s (%s)', (host, type, brand) => {
    expect(findLookalike(host)).toMatchObject({ type, brand })
  })

  it('flags IDN domains that match no brand as a weak signal', () => {
    expect(findLookalike('xn--mnchen-3ya.example')?.type).toBe('idn')
  })

  it.each([
    'www.paypal.com',
    'login.microsoftonline.com',
    'accounts.google.com',
    'appleid.apple.com',
    'www.amazon.co.uk',
    'secure.chase.com',
    'tools.usps.com',
    'www.dmv.ca.gov',
    'canvas.myuniversity.edu',
    'www.pineapple-farms.example',
    'purchase-orders.example',
    'apply-now.example',
    'phase-two.example',
    'www.contoso.example',
    'groups.example',
    'chasecapron.com',
    'purchase.chasecapron.com',
    'testsafebrowsing.appspot.com',
  ])('does not flag %s', (host) => {
    expect(findLookalike(host)).toBeNull()
  })
})
