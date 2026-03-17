/**
 * Login: phone + OTP only.
 * Country code selector, Send OTP → 6-digit OTP boxes → Verify OTP.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { sendOtp, verifyOtp } from '@/api/auth'
import { getMyWholesaler } from '@/api/wholesalers'
import { saveWholesaler } from '@/lib/storage'
import type { Wholesaler } from '@/types'

const LEDGER_WHOLESALER_KEY = 'ledger_wholesaler'

type Step = 'phone' | 'otp'

const COUNTRY_OPTIONS = [
  { code: '+91', label: 'India', dial: '91' },
  { code: '+1', label: 'United States', dial: '1' },
  { code: '+44', label: 'United Kingdom', dial: '44' },
  { code: '+971', label: 'UAE', dial: '971' },
  { code: '+61', label: 'Australia', dial: '61' },
  { code: '+49', label: 'Germany', dial: '49' },
  { code: '+33', label: 'France', dial: '33' },
  { code: '+81', label: 'Japan', dial: '81' },
  { code: '+65', label: 'Singapore', dial: '65' },
  { code: '+86', label: 'China', dial: '86' },
] as const

const OTP_LENGTH = 6
const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15
const RESEND_COOLDOWN_SEC = 60

export function Login() {
  const [step, setStep] = useState<Step>('phone')
  const [countryIndex, setCountryIndex] = useState(0)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  /** When backend returns dev_otp (console provider), we show/prefill it for testing. */
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const { setAuth } = useAuth()
  const navigate = useNavigate()

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const country = COUNTRY_OPTIONS[countryIndex]
  const fullPhone = `${country.code}${phoneNumber.replace(/\D/g, '')}`

  const phoneValidationError = ((): string | null => {
    const digits = phoneNumber.replace(/\D/g, '')
    if (digits.length === 0) return 'Enter your phone number'
    if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
      return `Phone number must be ${MIN_PHONE_DIGITS}–${MAX_PHONE_DIGITS} digits`
    }
    return null
  })()

  const otpString = otpDigits.join('')
  const canSendOtp = !loading && !phoneValidationError && phoneNumber.replace(/\D/g, '').length >= MIN_PHONE_DIGITS
  const canVerifyOtp = !loading && otpString.length === OTP_LENGTH

  const handleSendOtp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSendOtp) return
      setError(null)
      setLoading(true)
      try {
        const data = await sendOtp({ phone: fullPhone })
        setResendCooldown(RESEND_COOLDOWN_SEC)
        setStep('otp')
        if (data.dev_otp && data.dev_otp.length === OTP_LENGTH) {
          setDevOtp(data.dev_otp)
          setOtpDigits(data.dev_otp.split(''))
        } else {
          setDevOtp(null)
          setOtpDigits(Array(OTP_LENGTH).fill(''))
        }
        setTimeout(() => otpInputRefs.current[0]?.focus(), 50)
        console.log('[Login] send OTP success, moved to OTP step')
      } catch (err) {
        // Only show error on real API/network failure (backend returns 4xx/5xx or request fails)
        const message = err instanceof Error ? err.message : 'Failed to send OTP'
        setError(message)
        console.error('[Login] send OTP failed', { message })
      } finally {
        setLoading(false)
      }
    },
    [canSendOtp, fullPhone]
  )

  const handleVerifyOtp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canVerifyOtp) return
      setError(null)
      setLoading(true)
      try {
        const res = await verifyOtp({ phone: fullPhone, code: otpString })
        setAuth(res.access_token, res.user, res.has_wholesaler, res.refresh_token)
        if (res.has_wholesaler) {
          try {
            const w = await getMyWholesaler(res.access_token)
            const raw = w as unknown as Record<string, unknown>
            const normalized: Wholesaler = {
              id: String(raw.id),
              shopName: String(raw.shopName ?? raw.shop_name),
              ownerName: String(raw.ownerName ?? raw.owner_name),
              mobile: String(raw.mobile),
              address: String(raw.address),
              gstNumber: String(raw.gstNumber ?? raw.gst_number ?? ''),
              panNumber: String((raw.panNumber ?? raw.pan_number) ?? ''),
              tradeCreditDays: Number(raw.tradeCreditDays ?? raw.trade_credit_days ?? 0),
              createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
              updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
            }
            saveWholesaler(normalized)
          } catch {
            localStorage.removeItem(LEDGER_WHOLESALER_KEY)
          }
        } else {
          localStorage.removeItem(LEDGER_WHOLESALER_KEY)
        }
        if (res.has_wholesaler) {
          navigate('/home', { replace: true })
        } else {
          navigate('/register', { replace: true })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid OTP')
      } finally {
        setLoading(false)
      }
    },
    [canVerifyOtp, fullPhone, otpString, setAuth, navigate]
  )

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    setError(null)
    if (digit && index < OTP_LENGTH - 1) otpInputRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleBackToPhone = () => {
    setStep('phone')
    setError(null)
    setOtpDigits(Array(OTP_LENGTH).fill(''))
    setResendCooldown(0)
    setDevOtp(null)
  }

  const handleResendOtp = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      if (resendCooldown > 0 || loading) return
      setError(null)
      setLoading(true)
      try {
        const data = await sendOtp({ phone: fullPhone })
        setResendCooldown(RESEND_COOLDOWN_SEC)
        if (data.dev_otp && data.dev_otp.length === OTP_LENGTH) {
          setDevOtp(data.dev_otp)
          setOtpDigits(data.dev_otp.split(''))
        } else {
          setDevOtp(null)
          setOtpDigits(Array(OTP_LENGTH).fill(''))
        }
        setTimeout(() => otpInputRefs.current[0]?.focus(), 50)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resend code')
      } finally {
        setLoading(false)
      }
    },
    [fullPhone, resendCooldown, loading]
  )

  const layoutClass =
    'min-h-screen flex flex-col items-center justify-center p-4 bg-muted'
  const cardClass =
    'w-full max-w-[420px] rounded-2xl bg-card p-8 shadow-[0_2px_12px_rgba(0,0,0,0.08)]'

  if (step === 'otp') {
    return (
      <div className={layoutClass}>
        <div className={cardClass}>
          <header className="text-center mb-6">
            <h1 className="text-xl font-semibold text-foreground">Enter code</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {devOtp
                ? 'Development mode: OTP was not sent by SMS. Use the code below.'
                : `We sent a 6-digit code to ${fullPhone}`}
            </p>
            {devOtp && (
              <p
                className="text-xs text-primary font-mono mt-2 bg-primary/10 rounded-lg py-2 px-3"
                role="status"
                data-testid="dev-otp"
              >
                Your OTP: {devOtp}
              </p>
            )}
          </header>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex gap-2 justify-center">
              {otpDigits.map((d: string, i: number) => (
                <input
                  key={i}
                  ref={(el: HTMLInputElement | null) => {
                    otpInputRefs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleOtpKeyDown(i, e)}
                  className="w-11 h-12 rounded-lg border-2 border-input text-center text-lg font-medium text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Digit ${i + 1}`}
                  data-testid={`otp-input-${i}`}
                />
              ))}
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center" role="alert" data-testid="otp-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={!canVerifyOtp}
              className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="verify-otp-button"
            >
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>
          </form>

          <div className="mt-5 space-y-3 text-center">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || loading}
              className="block w-full text-sm text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
            >
              {resendCooldown > 0
                ? `Resend code in ${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')}`
                : 'Resend code'}
            </button>
            <p className="text-sm text-muted-foreground">
              Wrong number?{' '}
              <button
                type="button"
                onClick={handleBackToPhone}
                className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded font-medium"
              >
                Change number
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={layoutClass}>
      <div className={cardClass}>
        <header className="text-center mb-6">
          <h1 className="text-xl font-semibold text-foreground">Log in to Kanaka Dhara</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter phone number
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a country and enter your phone number.
          </p>
        </header>

        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label htmlFor="country" className="sr-only">
              Country
            </label>
            <select
              id="country"
              value={countryIndex}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCountryIndex(Number(e.target.value))}
              className="w-full h-12 pl-4 pr-10 rounded-lg border-2 border-input bg-card text-foreground font-medium focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23667781'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '20px',
              }}
            >
              {COUNTRY_OPTIONS.map((c, i) => (
                <option key={c.dial} value={i}>
                  {c.label} {c.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="phone" className="sr-only">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder={`${country.code} phone number`}
              value={phoneNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS))
                setError(null)
              }}
              className="w-full h-12 rounded-lg border-2 border-input px-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="phone-input"
            />
            {phoneValidationError && (
              <p className="text-sm text-red-600 mt-1" role="alert">
                {phoneValidationError}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSendOtp}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="send-otp-button"
          >
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      </div>
    </div>
  )
}
