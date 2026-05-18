import { useState } from 'react'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { Button } from './components/ui/button'
import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import { Input } from './components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from './components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/ui/tooltip'

function App() {
  const [name, setName] = useState('')

  return (
    <TooltipProvider delayDuration={150}>
      <main className="min-h-screen flex flex-col items-center gap-[var(--space-7)] px-[var(--space-6)] py-[var(--space-8)] bg-[var(--surface-1)] text-[var(--text-primary)]">
        <header className="w-full max-w-[640px] flex items-center justify-between gap-[var(--space-4)]">
          <h1 className="m-0 text-[length:var(--text-3xl)] leading-[var(--leading-tight)] tracking-tight font-[family-name:var(--font-sans)] text-[var(--text-primary)]">
            tela
          </h1>
          <ThemeSwitcher />
        </header>

        <Card className="w-full max-w-[640px]">
          <CardHeader>
            <CardTitle>Design tokens demo</CardTitle>
            <CardDescription>
              Every primitive on this page reads from semantic CSS custom
              properties. Flip the theme switcher above to re-skin them in real
              time.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-[var(--space-2)]">
              <label
                htmlFor="demo-input"
                className="text-[length:var(--text-sm)] text-[var(--text-muted)]"
              >
                Your name
              </label>
              <Input
                id="demo-input"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </CardBody>
          <CardFooter>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="primary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Hello{name ? `, ${name}` : ''}</DialogTitle>
                  <DialogDescription>
                    This dialog, its overlay, animation, radius, and accent
                    colour all flow from tokens.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="primary">Confirm</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Tokens-driven tooltip.</TooltipContent>
            </Tooltip>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
          </CardFooter>
        </Card>
      </main>
    </TooltipProvider>
  )
}

export default App
