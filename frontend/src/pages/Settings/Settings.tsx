import { useEffect, useState, type FormEvent } from "react"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { getAgency, updateAgency } from "../../api/agency"
import { getErrorMessage } from "../../api/client"
import { useBranding } from "../../context/BrandingContext"

const HEX = /^#[0-9a-fA-F]{6}$/
const FALLBACK_COLOR = "#1e3a5f"
const PRESET_COLORS = ["#1e3a5f", "#0f766e", "#15803d", "#b45309", "#b91c1c", "#7c3aed", "#be185d", "#111827"]

export function SettingsPage() {
  const { setLogoUrl: setBrandingLogo } = useBranding()
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [color, setColor] = useState("")
  const [logoUrl, setLogoUrl] = useState("")

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
      setBrandingLogo(agency.logo ?? "")
      setSaved(true)
    } catch (err) {
      setSaveError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorBanner message={loadError} onRetry={load} />
  if (!loaded) return <PageSpinner label="Loading settings…" />

  return (
    <>
      <PageHeader eyebrow="Settings" title="Agency branding" />
      <Card className="max-w-[560px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            label="Agency name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="brandColor" className="text-xs font-medium text-text-dim">
              Brand colour
            </label>
            <div className="flex items-center gap-2">
              <label
                className={`relative block h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border ${
                  swatch ? "border-border" : "border-dashed border-text-faint"
                }`}
                style={swatch ? { backgroundColor: swatch } : undefined}
                title="Pick brand colour"
              >
                <input
                  type="color"
                  aria-label="Pick brand colour"
                  value={swatch ?? FALLBACK_COLOR}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <input
                id="brandColor"
                name="brandColor"
                value={color}
                onChange={(e) => setColor(e.target.value.trim())}
                placeholder="#1e3a5f"
                maxLength={7}
                aria-invalid={!colorValid}
                className={`h-10 min-w-0 flex-1 rounded-md border bg-surface-2 px-3 text-sm text-text outline-none transition-colors placeholder:text-text-faint ${
                  colorValid ? "border-border focus:border-accent" : "border-bad focus:border-bad"
                }`}
              />
              <Button type="button" variant="secondary" className="h-10 py-0" onClick={() => setColor("")}>
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESET_COLORS.map((c) => {
                const selected = color.toLowerCase() === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use ${c}`}
                    aria-pressed={selected}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 cursor-pointer rounded-md border border-border transition-shadow ${
                      selected ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                )
              })}
            </div>
            {colorValid ? (
              <p className="text-xs text-text-faint">Hex colour. Leave empty to clear.</p>
            ) : (
              <p className="text-xs text-bad">Use a hex colour like #1e3a5f</p>
            )}
          </div>

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
