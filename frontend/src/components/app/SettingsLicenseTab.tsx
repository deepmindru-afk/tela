import { useState } from 'react'
import { BadgeCheck, KeyRound, Lock } from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { TextArea } from '../ui/textarea'
import { ApiError } from '../../lib/api'
import { useClearLicense, useLicense, useSetLicense } from '../../lib/queries/license'

// Instance-admin "License" tab — install / view / remove the self-host Enterprise
// key (internal/ee). Community (no key) is the default; a valid key unlocks the
// ee-gated features. When the key is pinned via TELA_LICENSE_KEY the panel is
// read-only (env always wins on the next boot).
export function SettingsLicenseTab() {
  const info = useLicense()
  const setLicense = useSetLicense()
  const clearLicense = useClearLicense()
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  const lic = info.data?.license
  const envLocked = info.data?.env_locked ?? false
  const active = lic?.valid ?? false
  const seatUsage = info.data?.seat_usage
  const overSeats = seatUsage ? seatUsage.used > seatUsage.licensed : false

  async function install() {
    setError(null)
    try {
      await setLicense.mutateAsync(token.trim())
      setToken('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось установить лицензионный ключ.')
    }
  }

  async function remove() {
    setError(null)
    try {
      await clearLicense.mutateAsync()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить лицензионный ключ.')
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)] max-w-[var(--measure,60ch)]">
      <header className="flex flex-col gap-[var(--space-1)]">
        <h2 className="m-0 text-[length:var(--text-lg)] font-medium text-[var(--text-primary)]">
          Лицензия
        </h2>
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          По умолчанию tela работает как открытая версия Community. Лицензионный
          ключ Enterprise открывает SSO, аудит и остальные возможности для команд
          на этом инстансе.
        </p>
      </header>

      {info.isError ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось загрузить статус лицензии.
        </p>
      ) : null}

      {overSeats && seatUsage ? (
        <p className="m-0 rounded-[var(--radius-md)] border border-[var(--warning-border,var(--border))] bg-[var(--warning-bg,var(--surface-sunk))] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-primary)]">
          На этом инстансе <strong>{seatUsage.used}</strong> активных пользователей, но лицензия покрывает{' '}
          <strong>{seatUsage.licensed}</strong> мест. Возможности Enterprise продолжают работать — обновите
          количество мест в подписке, чтобы сохранить лицензию.
        </p>
      ) : null}

      {/* Current edition */}
      <Card className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)]">
            {active ? (
              <BadgeCheck width={18} height={18} className="text-[var(--accent)]" aria-hidden />
            ) : (
              <KeyRound width={18} height={18} className="text-[var(--text-muted)]" aria-hidden />
            )}
            <span className="font-medium text-[var(--text-primary)]">
              {info.isPending
                ? 'Проверка лицензии…'
                : active
                  ? `Enterprise — ${lic?.tier}`
                  : 'Версия Community'}
            </span>
          </div>
          {info.isPending ? null : active ? (
            <Badge variant="accent">Активна</Badge>
          ) : (
            <Badge>Бесплатно</Badge>
          )}
        </div>

        {active && lic ? (
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-1)] text-[length:var(--text-sm)]">
            {lic.customer ? (
              <>
                <dt className="text-[var(--text-muted)]">Лицензиат</dt>
                <dd className="m-0 text-[var(--text-primary)]">{lic.customer}</dd>
              </>
            ) : null}
            {lic.seats > 0 ? (
              <>
                <dt className="text-[var(--text-muted)]">Места</dt>
                <dd className="m-0 text-[var(--text-primary)]">{lic.seats}</dd>
              </>
            ) : null}
            <dt className="text-[var(--text-muted)]">Возможности</dt>
            <dd className="m-0 text-[var(--text-primary)]">
              {lic.features.includes('*') ? 'Все возможности Enterprise' : lic.features.join(', ') || '—'}
            </dd>
            <dt className="text-[var(--text-muted)]">Истекает</dt>
            <dd className="m-0 text-[var(--text-primary)]">{lic.expires_at ? lic.expires_at.slice(0, 10) : 'Никогда'}</dd>
          </dl>
        ) : null}

        {active && info.data?.refreshable ? (
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Продлевается автоматически через telawiki.com при обновлении подписки — вручную
            переустанавливать не нужно (если этот инстанс имеет к нему доступ).
          </p>
        ) : active ? null : (
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            Лицензия не установлена. Продукт полностью работает и без неё — возможности
            Enterprise останутся заблокированными, пока не будет добавлен ключ.
          </p>
        )}

        {active && !envLocked ? (
          <div>
            <Button
              variant="ghost"
              onClick={remove}
              disabled={clearLicense.isPending}
            >
              Удалить лицензию
            </Button>
          </div>
        ) : null}
      </Card>

      {/* Install / replace */}
      {envLocked ? (
        <p className="m-0 flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
          <Lock width={15} height={15} aria-hidden />
          Лицензионный ключ задаётся переменной окружения <code>TELA_LICENSE_KEY</code>
          и не может быть изменён здесь.
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--space-2)]">
          <label htmlFor="license-token" className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
            {active ? 'Заменить лицензионный ключ' : 'Установить лицензионный ключ'}
          </label>
          <TextArea
            id="license-token"
            value={token}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setToken(e.target.value)}
            placeholder="tela_lic_…"
            rows={3}
            className="font-mono text-[length:var(--text-xs)]"
          />
          {error ? (
            <p className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">{error}</p>
          ) : null}
          <div>
            <Button onClick={install} disabled={setLicense.isPending || token.trim() === ''}>
              {active ? 'Заменить' : 'Установить'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
