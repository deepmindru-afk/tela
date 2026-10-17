import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useInstanceSettings,
  useUpdateInstanceSettings,
} from '../../lib/queries/instance-settings'
import { updateKeys, useCheckForUpdate, useUpdateStatus } from '../../lib/queries/updates'
import { authKeys } from '../../lib/queries/auth'
import { relativeTimeFromSqlite } from '../../lib/relativeTime'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Button } from '../ui/button'

// Instance-admin runtime configuration, backed by the instance_settings store.
// Changes apply immediately with no redeploy.
export function SettingsInstanceTab() {
  const settings = useInstanceSettings()
  const update = useUpdateInstanceSettings()

  // Absent or "true" = open (the default for an open team wiki); only the
  // literal "false" closes registration.
  const registrationOpen = settings.data?.['registration_open'] !== 'false'
  const aiDisabled = settings.data?.['ai.disabled'] === '1'

  return (
    <section
      aria-labelledby="settings-instance"
      className="flex flex-col gap-[var(--space-5)]"
    >
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
        Настройки всего инстанса. Изменения применяются сразу — без перезапуска.
      </p>

      {settings.isLoading ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка…</p>
      ) : settings.isError ? (
        <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось загрузить настройки инстанса.
        </p>
      ) : (
        <>
          <UpdatesSection />

          <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
            <label className="flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] cursor-pointer">
              <Checkbox
                checked={registrationOpen}
                disabled={update.isPending}
                aria-label="Разрешить самостоятельную регистрацию"
                onCheckedChange={(v) =>
                  update.mutate({ registration_open: v === true ? 'true' : 'false' })
                }
              />
              <span className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
                  Разрешить самостоятельную регистрацию
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
                  Если выключено, новые пользователи не могут регистрироваться
                  сами; администраторы инстанса по-прежнему могут создавать учётные записи напрямую.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] border-t border-[var(--border-subtle)] cursor-pointer">
              <Checkbox
                checked={aiDisabled}
                disabled={update.isPending}
                aria-label="Приостановить ИИ-возможности"
                onCheckedChange={(v) =>
                  update.mutate({ 'ai.disabled': v === true ? '1' : '0' })
                }
              />
              <span className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
                  Приостановить ИИ-возможности
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
                  Приостанавливает всё, что обращается к ИИ-бэкенду, — «вопросы к
                  вашим документам», семантический поиск и фоновое семантическое
                  индексирование (дозаполнение). В режиме вопросов появится спокойное
                  уведомление «приостановлено на обслуживание»; полнотекстовый поиск продолжит работать.
                  Дополните его баннером ниже.
                </span>
              </span>
            </label>
          </div>

          <MaintenanceNoticeEditor
            initialNotice={settings.data?.['maintenance.notice'] ?? ''}
            initialLevel={settings.data?.['maintenance.level'] === 'warning' ? 'warning' : 'info'}
            ready={settings.isSuccess}
            saving={update.isPending}
            onSave={(notice, level) =>
              update.mutate({ 'maintenance.notice': notice, 'maintenance.level': level })
            }
          />
        </>
      )}
    </section>
  )
}

// Self-host update check (backend update_check.go): where this instance stands
// against the latest release, and the switch that turns the daily check off.
// Hidden on the managed cloud and on dev builds, where there's nothing to compare.
function UpdatesSection() {
  const status = useUpdateStatus()
  const check = useCheckForUpdate()
  const update = useUpdateInstanceSettings()
  const qc = useQueryClient()
  const st = status.data
  if (!st?.applies) return null

  const toggle = (on: boolean) =>
    update.mutate(
      { 'updates.check': on ? 'on' : 'off' },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: updateKeys.status })
          void qc.invalidateQueries({ queryKey: authKeys.me() })
          if (on) check.mutate()
        },
      },
    )

  let line: React.ReactNode = `У вас установлена tela v${st.current}.`
  if (st.enabled && st.update_available) {
    line = (
      <>
        <span className="text-[var(--text-primary)] font-medium">Доступна tela v{st.latest}.</span>{' '}
        У вас установлена версия v{st.current}.{' '}
        {st.release_url ? (
          <a
            href={st.release_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] no-underline hover:underline"
          >
            Примечания к выпуску и шаги обновления →
          </a>
        ) : null}
      </>
    )
  } else if (st.enabled && st.latest) {
    line = `У вас последняя версия, v${st.current}.`
  }

  return (
    <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)]">
        <span className="flex-1 min-w-0 flex flex-col gap-[var(--space-1)]">
          <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">Обновления</span>
          <span className="text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
            {line}
          </span>
          {st.enabled && (st.checked_at || st.error) ? (
            <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
              {st.error
                ? `Последняя проверка не удалась (${st.error}).`
                : `Проверено ${relativeTimeFromSqlite(st.checked_at!)}.`}
            </span>
          ) : null}
        </span>
        {st.enabled ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={check.isPending}
            onClick={() => check.mutate()}
          >
            {check.isPending ? 'Проверка…' : 'Проверить сейчас'}
          </Button>
        ) : null}
      </div>
      <label
        className={
          'flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] border-t border-[var(--border-subtle)] ' +
          (st.env_locked ? 'cursor-not-allowed' : 'cursor-pointer')
        }
      >
        <Checkbox
          checked={st.enabled}
          disabled={st.env_locked || update.isPending}
          aria-label="Проверять новые версии"
          onCheckedChange={(v) => toggle(v === true)}
        />
        <span className="flex flex-col gap-[var(--space-1)]">
          <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
            Проверять новые версии
          </span>
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
            {st.env_locked
              ? 'Отключено переменной TELA_UPDATE_CHECK в окружении сервера.'
              : 'Раз в сутки запрашивает у telawiki.com последний выпуск tela и сообщает администраторам инстанса о новых версиях. Отправляется только номер вашей версии, ничего больше; telawiki.com считает, сколько инстансов проверяет обновления, не сохраняя IP-адреса.'}
          </span>
        </span>
      </label>
    </div>
  )
}

// The app-wide banner an admin sets — any message ("AI is paused for
// maintenance"). Saving an empty notice clears it. Local-edit + Save so it isn't
// written on every keystroke.
function MaintenanceNoticeEditor({
  initialNotice,
  initialLevel,
  ready,
  saving,
  onSave,
}: {
  initialNotice: string
  initialLevel: 'info' | 'warning'
  ready: boolean
  saving: boolean
  onSave: (notice: string, level: 'info' | 'warning') => void
}) {
  const [notice, setNotice] = useState(initialNotice)
  const [level, setLevel] = useState<'info' | 'warning'>(initialLevel)
  // Hydrate once from the loaded settings (adjust-state-when-a-prop-changes).
  const [hydrated, setHydrated] = useState(false)
  if (ready && !hydrated) {
    setNotice(initialNotice)
    setLevel(initialLevel)
    setHydrated(true)
  }

  const dirty = notice !== initialNotice || level !== initialLevel

  return (
    <div className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
          Баннер обслуживания
        </span>
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
          Ненавязчивое уведомление для всех — вверху приложения и на странице входа.
          Оставьте поле пустым, чтобы скрыть его.
        </span>
      </div>
      <div className="flex items-start gap-[var(--space-2)]">
        <div className="flex-1 min-w-0">
          <Input
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            placeholder="например, ИИ временно недоступен из-за обслуживания."
            aria-label="Уведомление об обслуживании"
          />
        </div>
        <Select
          value={level}
          onChange={(e) => setLevel(e.target.value as 'info' | 'warning')}
          aria-label="Важность уведомления"
          className="w-[8rem] shrink-0"
        >
          <option value="info">Информация</option>
          <option value="warning">Предупреждение</option>
        </Select>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || !dirty}
          onClick={() => onSave(notice.trim(), level)}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
    </div>
  )
}
