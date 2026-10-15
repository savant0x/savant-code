// error-handling test family — country-block extraction + availability
// messages. Sibling of the Loop 350 decomposition.
import { describe, test, expect } from 'bun:test'

import {
  getCountryBlockFromFreeModeError,
  getFreeModeUnavailableErrorMessage,
  FREE_MODE_UNAVAILABLE_MESSAGE,
} from '../error-handling'

describe('error-handling', () => {
  describe('getCountryBlockFromFreeModeError', () => {
    test('extracts country block details from free-mode unavailable errors', () => {
      const error = {
        statusCode: 403,
        error: 'free_mode_unavailable',
        countryCode: 'US',
        countryBlockReason: 'anonymous_network',
        ipPrivacySignals: ['vpn', 'hosting', 123],
      }

      expect(getCountryBlockFromFreeModeError(error)).toEqual({
        countryCode: 'US',
        countryBlockReason: 'anonymous_network',
        ipPrivacySignals: ['vpn', 'hosting'],
      })
    })

    test('extracts country block details from responseBody errors', () => {
      const error = {
        statusCode: 403,
        responseBody: JSON.stringify({
          error: 'free_mode_unavailable',
          countryCode: 'US',
          countryBlockReason: 'anonymous_network',
          ipPrivacySignals: ['proxy', 'hosting', 123],
        }),
      }

      expect(getCountryBlockFromFreeModeError(error)).toEqual({
        countryCode: 'US',
        countryBlockReason: 'anonymous_network',
        ipPrivacySignals: ['proxy', 'hosting'],
      })
    })

    test('defaults missing country code to UNKNOWN', () => {
      const error = {
        statusCode: 403,
        error: 'free_mode_unavailable',
      }

      expect(getCountryBlockFromFreeModeError(error)).toEqual({
        countryCode: 'UNKNOWN',
        countryBlockReason: undefined,
        ipPrivacySignals: undefined,
      })
    })

    test('returns null for non-free-mode errors', () => {
      expect(
        getCountryBlockFromFreeModeError({
          statusCode: 403,
          error: 'account_suspended',
        }),
      ).toBe(null)
    })
  })

  describe('FREE_MODE_UNAVAILABLE_MESSAGE', () => {
    test('mentions unavailability in country', () => {
      expect(FREE_MODE_UNAVAILABLE_MESSAGE.toLowerCase()).toContain(
        'not available in your country',
      )
    })
  })

  describe('getFreeModeUnavailableErrorMessage', () => {
    test('uses a VPN/proxy-specific message for anonymous-network blocks', () => {
      expect(
        getFreeModeUnavailableErrorMessage({
          statusCode: 403,
          error: 'free_mode_unavailable',
          message: 'Forbidden',
          countryBlockReason: 'anonymous_network',
          ipPrivacySignals: ['vpn', 'hosting'],
        }),
      ).toContain('VPN')
    })

    test('uses a VPN/proxy-specific message from responseBody details', () => {
      expect(
        getFreeModeUnavailableErrorMessage({
          statusCode: 403,
          message: 'Forbidden',
          responseBody: JSON.stringify({
            error: 'free_mode_unavailable',
            countryBlockReason: 'anonymous_network',
            ipPrivacySignals: ['tor'],
          }),
        }),
      ).toContain('Tor')
    })

    test('preserves server message for non-privacy free mode blocks', () => {
      expect(
        getFreeModeUnavailableErrorMessage({
          statusCode: 403,
          error: 'free_mode_unavailable',
          message: 'Free mode is not available in your country.',
        }),
      ).toBe('Free mode is not available in your country.')
    })
  })
})
