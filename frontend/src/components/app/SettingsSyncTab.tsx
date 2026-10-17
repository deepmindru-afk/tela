import { useState } from 'react'
import { Copy, Folder, Link2, ShieldAlert } from 'lucide-react'
import { ApiError } from '../../lib/api'
import {
  useCreateSyncConnection,
  useRevokeSyncConnection,
  useSyncConnections,
  type CreateSyncConnectionInput,
  type RcloneSetup,
  type SyncConnectionCreated,
} from '../../lib/queries/sync-connections'
import { useSpaces } from '../../lib/queries/spaces'
import { localDateFromSqlite, relativeTimeFromSqlite } from '../../lib/relativeTime'
import type { ApiKeyRow } from '../../lib/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle'
import { cn } from '../../lib/utils'
import { DOCS } from '../../lib/docs'

const NAME_MAX_LEN = 64
const ALL_SPACES_VALUE = '__all__'
const COPIED_FLASH_MS = 1200

export function SettingsSyncTab() {
  const connections = useSyncConnections()
  const [created, setCreated] = useState<SyncConnectionCreated | null>(null)

  return (
    <section
      aria-labelledby="settings-sync"
      className="flex flex-col gap-[var(--space-5)]"
    >
      <header className="flex flex-col gap-[var(--space-1)]" id="settings-sync">
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
          Подключите свои пространства как локальную папку с помощью{' '}
          <a
            href="https://rclone.org"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] underline underline-offset-2"
          >
            rclone
          </a>{' '}
          и редактируйте их как обычный markdown в любом приложении. Подключите
          хранилище ниже — оно создаст токен синхронизации и проведёт вас по настройке.
          Правки объединяются на сервере, поэтому редактировать в приложении и на диске
          одновременно безопасно.
        </p>
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
          <a
            href={DOCS.webdav}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] underline underline-offset-2"
          >
            Руководство по настройке WebDAV и rclone →
          </a>
        </p>
      </header>

      <ConnectForm onCreated={setCreated} />

      <ConnectionsList
        connections={connections.data ?? []}
        loading={connections.isLoading}
        isError={connections.isError}
      />

      <SetupDialog
        created={created}
        onOpenChange={(open) => {
          if (!open) setCreated(null)
        }}
      />
    </section>
  )
}

interface ConnectFormProps {
  onCreated: (created: SyncConnectionCreated) => void
}

function ConnectForm({ onCreated }: ConnectFormProps) {
  const spaces = useSpaces()
  const create = useCreateSyncConnection()
  const [name, setName] = useState('')
  const [spaceValue, setSpaceValue] = useState<string>(ALL_SPACES_VALUE)
  const [mode, setMode] = useState<'two-way' | 'read-only'>('two-way')
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setName('')
    setSpaceValue(ALL_SPACES_VALUE)
    setMode('two-way')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Укажите название подключения (например, устройства).')
      return
    }
    if (trimmed.length > NAME_MAX_LEN) {
      setError(`Название — не более ${NAME_MAX_LEN} символов.`)
      return
    }
    setError(null)
    const input: CreateSyncConnectionInput = {
      name: trimmed,
      space_id: spaceValue === ALL_SPACES_VALUE ? null : Number(spaceValue),
      read_only: mode === 'read-only',
    }
    try {
      onCreated(await create.mutateAsync(input))
      resetForm()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        return
      }
      setError('Не удалось подключиться. Попробуйте ещё раз.')
    }
  }

  return (
    <section
      aria-label="Подключение хранилища"
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--border-subtle)]',
        'bg-[var(--surface-1)]',
        'px-[var(--space-4)] py-[var(--space-4)]',
      )}
    >
      <h2 className="m-0 mb-[var(--space-3)] font-[family-name:var(--font-sans)] text-[length:var(--text-base)] leading-[var(--leading-tight)] text-[var(--text-primary)]">
        Подключить хранилище
      </h2>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-[var(--space-4)]"
        noValidate
      >
        <Field label="Название подключения" htmlFor="sync-name">
          <Input
            id="sync-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="например, ноутбук, рабочий компьютер"
            maxLength={NAME_MAX_LEN}
            autoComplete="off"
          />
        </Field>

        <Field label="Что синхронизировать" htmlFor="sync-space">
          {spaces.isLoading ? (
            <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
              Загрузка пространств…
            </p>
          ) : spaces.isError || !spaces.data ? (
            <p
              role="alert"
              className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]"
            >
              Не удалось загрузить пространства.
            </p>
          ) : (
            <Select
              id="sync-space"
              value={spaceValue}
              onChange={(e) => setSpaceValue(e.target.value)}
            >
              <option value={ALL_SPACES_VALUE}>
                Всё рабочее пространство (все пространства)
              </option>
              {spaces.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Направление">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(next) => {
              if (next === 'two-way' || next === 'read-only') setMode(next)
            }}
            aria-label="Направление синхронизации"
          >
            <ToggleGroupItem value="two-way">Двусторонняя</ToggleGroupItem>
            <ToggleGroupItem value="read-only">Только чтение</ToggleGroupItem>
          </ToggleGroup>
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
            {mode === 'two-way'
              ? 'Правьте на диске и в приложении; изменения объединяются в обе стороны.'
              : 'Только локальная копия — локальные правки не отправляются обратно.'}
          </p>
        </Field>

        {error ? (
          <p
            role="alert"
            className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            <Link2 width={14} height={14} />
            <span>{create.isPending ? 'Подключение…' : 'Подключить'}</span>
          </Button>
        </div>
      </form>
    </section>
  )
}

interface ConnectionsListProps {
  connections: ApiKeyRow[]
  loading: boolean
  isError: boolean
}

function ConnectionsList({ connections, loading, isError }: ConnectionsListProps) {
  if (loading) {
    return (
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Загрузка подключений…
      </p>
    )
  }
  if (isError) {
    return (
      <p
        role="alert"
        className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]"
      >
        Не удалось загрузить подключения.
      </p>
    )
  }
  const active = connections.filter((c) => !c.revoked_at)
  if (active.length === 0) {
    return (
      <p
        className={cn(
          'm-0 rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)]',
          'px-[var(--space-4)] py-[var(--space-5)]',
          'text-[length:var(--text-sm)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]',
          'text-center',
        )}
      >
        Подключённых хранилищ пока нет. Подключите одно выше.
      </p>
    )
  }
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-2)]">
      {active.map((c) => (
        <ConnectionRow key={c.id} row={c} />
      ))}
    </ul>
  )
}

function ConnectionRow({ row }: { row: ApiKeyRow }) {
  const spaces = useSpaces()
  const revoke = useRevokeSyncConnection()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const spaceLabel =
    row.space_id == null
      ? 'Всё рабочее пространство'
      : (spaces.data?.find((s) => s.id === row.space_id)?.name ??
        `Пространство #${row.space_id}`)
  const lastUsedLabel =
    row.last_used_at != null ? relativeTimeFromSqlite(row.last_used_at) : 'никогда'

  async function handleRevoke() {
    setError(null)
    try {
      await revoke.mutateAsync(row.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отключить.')
      setConfirming(false)
    }
  }

  return (
    <li
      className={cn(
        'm-0 list-none flex flex-col gap-[var(--space-2)]',
        'px-[var(--space-3)] py-[var(--space-3)] rounded-[var(--radius-sm)]',
        'border border-[var(--border-subtle)] bg-[var(--surface-1)]',
      )}
    >
      <div className="flex items-start gap-[var(--space-3)]">
        <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
          <div className="flex items-center gap-[var(--space-2)] min-w-0 flex-wrap">
            <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium font-[family-name:var(--font-sans)]">
              {row.name}
            </span>
            <Badge variant="muted">
              {row.scope === 'read' ? 'Только чтение' : 'Двусторонняя'}
            </Badge>
            <Badge variant="muted">{spaceLabel}</Badge>
          </div>
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
            Последняя синхронизация: {lastUsedLabel} · Подключено{' '}
            {localDateFromSqlite(row.created_at)}
          </span>
        </div>
        {!confirming ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null)
              setConfirming(true)
            }}
            aria-label={`Отключить ${row.name}`}
            disabled={revoke.isPending}
          >
            Отключить
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <div
          className={cn(
            'flex items-center justify-between gap-[var(--space-2)]',
            'rounded-[var(--radius-sm)] bg-[var(--surface-2)]',
            'px-[var(--space-2)] py-[var(--space-2)]',
          )}
        >
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
            Отключить <strong>{row.name}</strong>? Токен перестанет работать
            немедленно; локальные файлы останутся на месте.
          </span>
          <div className="flex items-center gap-[var(--space-1)] shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={revoke.isPending}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => void handleRevoke()}
              disabled={revoke.isPending}
            >
              {revoke.isPending ? 'Отключение…' : 'Отключить'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
    </li>
  )
}

interface SetupDialogProps {
  created: SyncConnectionCreated | null
  onOpenChange: (open: boolean) => void
}

type VaultOS = 'linux' | 'macos'

// MountSteps is steps 2–3 for one OS: macOS has no FUSE (macFUSE is a kext
// needing Reduced Security + a reboot), so it mounts over NFS and keeps the
// mount alive with a launchd agent instead of a systemd user unit.
function MountSteps({
  rclone,
  macos,
}: {
  rclone: RcloneSetup
  macos: boolean
}) {
  return (
    <>
      <Step n={2} title="Смонтируйте папку (попробуйте прямо сейчас)">
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)] leading-[var(--leading-relaxed)]">
          Ваше хранилище появится в{' '}
          <code className="font-[family-name:var(--font-mono)]">
            {rclone.local_dir}
          </code>
          . Редактируйте файлы любым приложением — изменения синхронизируются
          в обе стороны
          {rclone.read_only ? ' (только чтение)' : ''}. Нажмите Ctrl-C, чтобы отмонтировать.
          {macos ? ' macFUSE не нужен — монтирование выполняется через NFS.' : ''}
        </p>
        <CommandBlock
          command={macos ? rclone.mount_command_macos : rclone.mount_command}
        />
      </Step>

      <Step
        n={3}
        title={
          macos
            ? 'Поддерживайте монтирование (macOS · launchd)'
            : 'Поддерживайте монтирование (Linux · systemd)'
        }
      >
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)] leading-[var(--leading-relaxed)]">
          Чтобы хранилище монтировалось при входе и перезапускалось при сбое.
          Сохраните это как{' '}
          <code className="font-[family-name:var(--font-mono)]">
            {macos
              ? `~/Library/LaunchAgents/${rclone.launchd_label}.plist`
              : `~/.config/systemd/user/${rclone.service_name}.service`}
          </code>
          :
        </p>
        <CommandBlock
          command={macos ? rclone.launchd_plist : rclone.systemd_unit}
        />
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
          Затем включите его:
        </p>
        <CommandBlock
          command={macos ? rclone.launchd_install : rclone.systemd_install}
        />
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)] leading-[var(--leading-relaxed)]">
          {macos ? (
            <>
              Проверьте командой{' '}
              <code className="font-[family-name:var(--font-mono)]">
                launchctl print gui/$(id -u)/{rclone.launchd_label}
              </code>
              .
            </>
          ) : (
            <>
              Проверьте командой{' '}
              <code className="font-[family-name:var(--font-mono)]">
                systemctl --user status {rclone.service_name}
              </code>
              .
            </>
          )}{' '}
          В Windows или если нужны настоящие локальные файлы вместо живого
          монтирования, смотрите документацию по синхронизации.
        </p>
      </Step>
    </>
  )
}

function SetupDialog({ created, onOpenChange }: SetupDialogProps) {
  const rclone = created?.rclone
  // Default to the platform the browser is on — the commands differ per OS and
  // the right one should be the one already on screen.
  const [os, setOs] = useState<VaultOS>(() =>
    /mac/i.test(navigator.userAgent) ? 'macos' : 'linux',
  )
  return (
    <Dialog open={created != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Хранилище подключено — смонтируйте его как папку</DialogTitle>
          <DialogDescription>
            rclone показывает tela как обычную папку, которую можно открыть любым
            приложением; правки синхронизируются автоматически. Вставьте команды в
            терминал по порядку. (Понадобится установленный rclone.)
          </DialogDescription>
        </DialogHeader>
        {rclone ? (
          <div className="flex flex-col gap-[var(--space-4)] max-h-[60vh] overflow-y-auto">
            <div
              className={cn(
                'flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)]',
                'border border-[var(--border-subtle)] bg-[var(--surface-2)]',
                'px-[var(--space-3)] py-[var(--space-2)]',
              )}
            >
              <Folder
                aria-hidden
                width={15}
                height={15}
                className="shrink-0 text-[var(--text-muted)]"
              />
              <span className="text-[length:var(--text-xs)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
                Ваше хранилище появится в{' '}
                <code className="font-[family-name:var(--font-mono)]">
                  {rclone.local_dir}
                </code>{' '}
                — откройте его любым редактором.
              </span>
            </div>

            <Step n={1} title="Связать tela с rclone">
              <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
                Выполните один раз на этом устройстве — это создаст подключение.
              </p>
              <CommandBlock command={rclone.config_create_command} />
              <div
                className={cn(
                  'flex items-start gap-[var(--space-2)] rounded-[var(--radius-sm)]',
                  'border border-[var(--accent)] bg-[var(--surface-1)]',
                  'px-[var(--space-2)] py-[var(--space-1)]',
                )}
              >
                <ShieldAlert
                  aria-hidden
                  width={14}
                  height={14}
                  className="mt-[2px] shrink-0 text-[var(--accent)]"
                />
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)] leading-[var(--leading-relaxed)]">
                  В этой строке содержится ваш токен доступа — относитесь к нему
                  как к паролю.
                </span>
              </div>
              <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)] leading-[var(--leading-relaxed)]">
                Подключали хранилище на другой машине до сентября 2026 года? Выполните
                команду и там: в старых настройках использовался профиль клиента, который
                не передаёт время изменения файлов, поэтому rclone молча пропускал ваши правки:
              </p>
              <CommandBlock command={rclone.fix_vendor_command} />
            </Step>

            <Tabs
              value={os}
              onValueChange={(v) => setOs(v as VaultOS)}
              className="flex flex-col gap-[var(--space-4)]"
            >
              <TabsList>
                <TabsTrigger value="linux">Linux</TabsTrigger>
                <TabsTrigger value="macos">macOS</TabsTrigger>
              </TabsList>
              <TabsContent
                value="linux"
                className="flex flex-col gap-[var(--space-4)]"
              >
                <MountSteps rclone={rclone} macos={false} />
              </TabsContent>
              <TabsContent
                value="macos"
                className="flex flex-col gap-[var(--space-4)]"
              >
                <MountSteps rclone={rclone} macos />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="primary"
                onClick={() => onOpenChange(false)}
              >
                Готово
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div className="flex items-center gap-[var(--space-2)]">
        <span
          aria-hidden
          className={cn(
            'shrink-0 inline-flex items-center justify-center rounded-full',
            'h-[var(--space-5)] w-[var(--space-5)]',
            'bg-[var(--surface-3)] text-[var(--text-primary)]',
            'text-[length:var(--text-xs)] font-medium',
          )}
        >
          {n}
        </span>
        <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-[var(--space-2)] pl-[var(--space-6)]">
        {children}
      </div>
    </div>
  )
}

function CommandBlock({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) return
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPIED_FLASH_MS)
    } catch {
      // Best-effort — the user can select the text manually.
    }
  }
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        {label ? (
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
            {label}
          </span>
        ) : (
          <span />
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => void copy()}>
          <Copy width={13} height={13} />
          <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
        </Button>
      </div>
      <pre className="m-0 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-xs)] text-[var(--text-primary)] font-[family-name:var(--font-mono)] leading-[var(--leading-relaxed)] whitespace-pre-wrap break-all">
        {command}
      </pre>
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <label
        htmlFor={htmlFor}
        className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)] font-[family-name:var(--font-sans)]"
      >
        {label}
      </label>
      {children}
    </div>
  )
}
