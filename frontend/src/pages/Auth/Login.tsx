import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AuthLayout } from "./AuthLayout"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { ErrorBanner } from "../../components/ErrorBanner"
import { useAuth } from "../../context/AuthContext"
import { getErrorMessage } from "../../api/client"
import { fieldErrors, loginFormSchema } from "../../lib/schemas"

interface LocationState {
  from?: { pathname: string }
  registeredEmail?: string
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? null

  const [email, setEmail] = useState(state?.registeredEmail ?? "")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Partial<Record<"email" | "password", string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const result = loginFormSchema.safeParse({ email, password })
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})

    setLoading(true)
    try {
      await login(result.data.email, result.data.password)
      const redirectTo = state?.from?.pathname ?? "/"
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to check your clients' AI visibility"
      footer={
        <>
          Don't have an agency account?{" "}
          <Link to="/register" className="font-medium text-accent hover:text-accent-hover">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? <ErrorBanner message={formError} /> : null}
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
