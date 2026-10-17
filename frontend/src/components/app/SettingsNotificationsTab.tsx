import {
  useNotificationPrefs,
  useUpdateNotificationPref,
  type NotificationPref,
} from '../../lib/queries/notification-prefs'
import { useAutowatch, useSetAutowatch } from '../../lib/queries/subscriptions'
import { useDigestPref, useSetDigestPref } from '../../lib/queries/digest'
import { useMe } from '../../lib/queries/auth'
import { Checkbox } from '../ui/checkbox'
import { cn } from '../../lib/utils'

// The event types + channels the matrix renders. Mirrors the backend's
// notificationEventTypes / notificationChannels; adding one there + here exposes
// it. Both in-app and email are delivered. `adminOnly` rows show only to instance
// admins (the recipient set the backend emits them to).
const EVENTS: { type: string; label: string; desc: string; adminOnly?: boolean }[] = [
  { type: 'mention', label: 'Упоминания', desc: 'Когда вас @упоминают на странице.' },
  {
    type: 'page_updated',
    label: 'Обновления страниц',
    desc: 'Когда меняется страница или пространство, на которое вы подписаны.',
  },
  {
    type: 'page_created',
    label: 'Новые страницы',
    desc: 'Когда в отслеживаемое вами пространство добавляется новая страница.',
  },
  {
    type: 'comment_reply',
    label: 'Ответы на комментарии',
    desc: 'Когда кто-то отвечает на ваш комментарий.',
  },
  {
    type: 'space_added',
    label: 'Добавление в пространство',
    desc: 'Когда кто-то предоставляет вам доступ к пространству.',
  },
  {
    type: 'atlas_run',
    label: 'Запуски Атласа',
    desc: 'Когда управляемый вами прогон генерации Атласа завершается или завершается с ошибкой.',
  },
  {
    type: 'user_registered',
    label: 'Новые регистрации',
    desc: 'Когда новый аккаунт подтверждает свою почту на этом инстансе.',
    adminOnly: true,
  },
]
const CHANNELS: { channel: string; label: string }[] = [
  { channel: 'inapp', label: 'В приложении' },
  { channel: 'email', label: 'Электронная почта' },
]

export function SettingsNotificationsTab() {
  const prefs = useNotificationPrefs()
  const update = useUpdateNotificationPref()
  const autowatch = useAutowatch()
  const setAutowatch = useSetAutowatch()
  const digest = useDigestPref()
  const setDigest = useSetDigestPref()
  const me = useMe()
  const events = EVENTS.filter((ev) => !ev.adminOnly || me.data?.is_instance_admin)

  const enabled = (eventType: string, channel: string): boolean =>
    prefs.data?.find((p) => p.event_type === eventType && p.channel === channel)?.enabled ?? true

  function toggle(pref: NotificationPref) {
    update.mutate(pref)
  }

  return (
    <section aria-labelledby="settings-notifications" className="flex flex-col gap-[var(--space-4)]">
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
        Выберите, о чём вас уведомлять. Подпишитесь на страницу или пространство
        (значок колокольчика в его заголовке), чтобы получать обновления.
      </p>

      <label className="flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
        <Checkbox
          checked={digest.data?.frequency === 'weekly'}
          disabled={digest.isLoading || setDigest.isPending}
          aria-label="Еженедельная сводка на почту"
          onCheckedChange={(v) => setDigest.mutate(v === true ? 'weekly' : 'off')}
          className="mt-[2px]"
        />
        <span className="flex flex-col gap-[1px]">
          <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
            Еженедельная сводка на почту
          </span>
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Итоги понедельника по всем изменениям в ваших пространствах и по тому, что
            требует вашего внимания. Если ничего не изменилось, письмо не отправляется.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
        <Checkbox
          checked={autowatch.data ?? true}
          disabled={autowatch.isLoading || setAutowatch.isPending}
          aria-label="Автоматически подписываться на страницы, которые я создаю, редактирую или комментирую"
          onCheckedChange={(v) => setAutowatch.mutate(v === true)}
          className="mt-[2px]"
        />
        <span className="flex flex-col gap-[1px]">
          <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
            Автоматически подписываться на страницы, с которыми я работаю
          </span>
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Подписывайтесь на страницу, когда вы её создаёте, редактируете или
            комментируете, чтобы узнавать о дальнейших изменениях. Отключите, чтобы
            подписываться только вручную.
          </span>
        </span>
      </label>

      {prefs.isLoading ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка…</p>
      ) : prefs.isError ? (
        <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось загрузить ваши настройки.
        </p>
      ) : (
        <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-2)] bg-[var(--surface-2)] border-b border-[var(--border-subtle)]">
            <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
              Событие
            </span>
            {CHANNELS.map((c) => (
              <span
                key={c.channel}
                className="text-center text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]"
              >
                {c.label}
              </span>
            ))}
          </div>

          {events.map((ev, i) => (
            <div
              key={ev.type}
              className={cn(
                'grid grid-cols-[1fr_5rem_5rem] items-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)]',
                i > 0 && 'border-t border-[var(--border-subtle)]',
              )}
            >
              <div className="flex flex-col gap-[1px] min-w-0">
                <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
                  {ev.label}
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
                  {ev.desc}
                </span>
              </div>
              {CHANNELS.map((c) => (
                <div key={c.channel} className="flex justify-center">
                  <Checkbox
                    checked={enabled(ev.type, c.channel)}
                    disabled={update.isPending}
                    aria-label={`${ev.label} — ${c.label}`}
                    onCheckedChange={(v) =>
                      toggle({ event_type: ev.type, channel: c.channel, enabled: v === true })
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
