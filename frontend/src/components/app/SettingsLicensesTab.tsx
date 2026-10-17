import { useState } from 'react'
import { Check, Copy, KeyRound, Server } from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ApiError } from '../../lib/api'
import { useMyLicenses, useSelfHostCheckout, useSelfHostPortal, type SelfHostLicense } from '../../lib/queries/billing'
import { ruPlural } from '../../lib/ru-plural'

// Buyer-facing "Self-host licenses" tab (managed cloud). Purchase a self-host
// Enterprise license (seat-based Polar checkout) and copy the minted key into
// your own instance's Settings → License. Distinct from SettingsLicenseTab, which
// is the instance-admin side that INSTALLS a key. Only shown where sales_enabled.

// Russian plural for counted nouns: 1 место, 2 места, 5 мест.
export function SettingsLicensesTab() {
  const info = useMyLicenses()
  const checkout = useSelfHostCheckout()
  const portal = useSelfHostPortal()
  const [seats, setSeats] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const licenses = info.data?.licenses ?? []
  const salesEnabled = info.data?.sales_enabled ?? false

  async function buy() {
    setError(null)
    try {
      await checkout.mutateAsync({ seats: Math.max(1, seats) })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось начать оформление покупки.')
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)] max-w-[var(--measure,60ch)]">
      <header className="flex flex-col gap-[var(--space-1)]">
        <h2 className="m-0 text-[length:var(--text-lg)] font-medium text-[var(--text-primary)]">
          Лицензии для самостоятельного размещения
        </h2>
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Купите лицензию Enterprise для самостоятельного размещения, затем вставьте
          ключ в свой инстанс в разделе Настройки&nbsp;→&nbsp;Лицензия, чтобы открыть SSO, SCIM, аудит и премиальные коннекторы.
        </p>
      </header>

      {info.isError ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось загрузить ваши лицензии.
        </p>
      ) : (
      <>
      {/* Buy */}
      {salesEnabled ? (
        <Card className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Server width={18} height={18} className="text-[var(--accent)]" aria-hidden />
            <span className="font-medium text-[var(--text-primary)]">Купить лицензию</span>
            <Badge variant="accent">$8 / место / мес</Badge>
          </div>
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            Оплата ежегодная. Ключ придёт на вашу почту и появится ниже — установите его
            на своих серверах.
          </p>
          <div className="flex items-end gap-[var(--space-3)]">
            <label className="flex flex-col gap-[var(--space-1)]">
              <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">Места</span>
              <Input
                type="number"
                min={1}
                value={seats}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeats(parseInt(e.target.value, 10) || 1)}
                className="w-[8ch]"
              />
            </label>
            <Button onClick={buy} disabled={checkout.isPending}>
              {checkout.isPending ? 'Переход…' : 'Перейти к оплате'}
            </Button>
          </div>
          {error ? (
            <p className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">{error}</p>
          ) : null}
        </Card>
      ) : (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Лицензии Enterprise для самостоятельного размещения покупаются в{' '}
          <a href="https://telawiki.com/pricing#self-host" className="text-[var(--accent)] underline">
            облаке tela
          </a>
          . Все ключи, которые у вас уже есть, перечислены ниже.
        </p>
      )}

      {/* Owned keys */}
      {info.isPending ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка…</p>
      ) : licenses.length === 0 ? (
        <p className="m-0 flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
          <KeyRound width={15} height={15} aria-hidden />
          Лицензий пока нет.
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--space-3)]">
          <div className="flex items-center justify-between gap-[var(--space-2)]">
            <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">Ваши лицензии</span>
            <Button variant="ghost" onClick={() => portal.mutate()} disabled={portal.isPending}>
              Управление подпиской
            </Button>
          </div>
          {licenses.map((lic) => (
            <LicenseRow key={lic.id} lic={lic} />
          ))}
        </div>
      )}
      </>
      )}
    </div>
  )
}

function LicenseRow({ lic }: { lic: SelfHostLicense }) {
  const [copied, setCopied] = useState(false)
  const active = lic.status === 'active'

  async function copy() {
    try {
      await navigator.clipboard.writeText(lic.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the key is still visible to select manually */
    }
  }

  return (
    <Card className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        <span className="font-medium text-[var(--text-primary)]">
          Enterprise{lic.seats > 0 ? ` — ${lic.seats} ${ruPlural(lic.seats, 'место', 'места', 'мест')}` : ''}
        </span>
        <Badge variant={active ? 'accent' : undefined}>
          {active ? 'Активна' : lic.status}
        </Badge>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-1)] text-[length:var(--text-sm)]">
        <dt className="text-[var(--text-muted)]">Истекает</dt>
        <dd className="m-0 text-[var(--text-primary)]">{lic.expires_at ? lic.expires_at.slice(0, 10) : 'Никогда'}</dd>
      </dl>
      <div className="flex items-center gap-[var(--space-2)]">
        <code className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] bg-[var(--surface-sunk,var(--bg-muted))] px-[var(--space-2)] py-[var(--space-1)] font-mono text-[length:var(--text-xs)] text-[var(--text-primary)]">
          {lic.token}
        </code>
        <Button variant="ghost" onClick={copy} aria-label="Копировать лицензионный ключ">
          {copied ? <Check width={15} height={15} aria-hidden /> : <Copy width={15} height={15} aria-hidden />}
        </Button>
      </div>
    </Card>
  )
}
