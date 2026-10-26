import { useEffect, useState, type FormEvent } from "react"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { getAgency, updateAgency } from "../../api/agency"
import { getErrorMessage } from "../../api/client"

const HEX = /^#[0-9a-fA-F]{6}$/
const FALLBACK_COLOR = "#1e3a5f"

export function SettingsPage() {
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [color, setColor] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoFailed, setLogoFailed] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function load() {
    setLoadError(null)
    try {
      const agency = await getAgency()
      setName(agency.name)
      setColor(agency.brandColors?.[0] ?? "")
      setLogoUrl(agency.logo ?? "")
      setLoaded(true)
    } catch (err) {
      setLoadError(getErrorMessage(err))
    }
  }

  useEffect(() => {
    load()
  }, [])

  // A new URL gets a fresh chance to load.
  useEffect(() => setLogoFailed(false), [logoUrl])

  const colorValid = color === "" || HEX.test(color)
  const swatch = HEX.test(color) ? color : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!colorValid) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const agency = await updateAgency({ name: name.trim(), brandColor: color, logoUrl: logoUrl.trim() })
      setName(agency.name)
      setColor(agency.brandColors?.[0] ?? "")
      setLogoUrl(agency.logo ?? "")
      setSaved(true)
    } catch (err) {
      setSaveError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorBanner message={loadError} onRetry={load} />
  if (!loaded) return <PageSpinner label="Loading settings…" />

  const showLogo = logoUrl.trim() !== "" && !logoFailed

  return (
    <>
      <PageHeader eyebrow="Settings" title="Agency branding" />
      <Card>
        <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
          <Input
            label="Agency name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Brand colour"
                name="brandColor"
                value={color}
                onChange={(e) => setColor(e.target.value.trim())}
                placeholder="#1e3a5f"
                maxLength={7}
                error={colorValid ? undefined : "Use a hex colour like #1e3a5f"}
                hint="Leave empty to clear."
              />
            </div>
            <input
              type="color"
              aria-label="Pick brand colour"
              value={swatch ?? FALLBACK_COLOR}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-md border border-border bg-surface-2 p-1"
            />
            <div
              aria-label="Colour preview"
              className="h-10 w-10 shrink-0 rounded-md border border-border"
              style={swatch ? { backgroundColor: swatch } : undefined}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Input
              label="Logo URL"
              name="logoUrl"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              maxLength={500}
              hint="An http(s) link. Leave empty to clear."
            />
            {showLogo && (
              <img
                src={logoUrl.trim()}
                alt="Logo preview"
                onError={() => setLogoFailed(true)}
                className="max-h-16 max-w-48 self-start rounded-md border border-border bg-white object-contain p-1"
              />
            )}
          </div>

          {saveError && (
            <p role="alert" className="text-sm text-bad">
              {saveError}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-good">
              Settings saved.
            </p>
          )}

          <div>
            <Button type="submit" loading={saving} disabled={!colorValid}>
              Save settings
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
