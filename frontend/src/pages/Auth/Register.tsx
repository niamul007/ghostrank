import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthLayout } from "./AuthLayout"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { ErrorBanner } from "../../components/ErrorBanner"
import { useAuth } from "../../context/AuthContext"
import { register } from "../../api/auth"
import { getErrorMessage } from "../../api/client"
import { fieldErrors, registerFormSchema } from "../../lib/schemas"

type Field = "name" | "email" | "password" | "confirmPassword"

export function RegisterPage() {
  const { rememberIdentity } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function setField(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const result = registerFormSchema.safeParse(values)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})

    setLoading(true)
    try {
      const agency = await register({
        name: result.data.name,
        email: result.data.email,
        password: result.data.password,
      })
      // Registering doesn't log the agency in (no token is issued) — the
      // backend requires a separate login call. Remember the name so the
      // top bar can show it once they do log in, in the same browser session.
      rememberIdentity({ name: agency.name, email: agency.email })
      navigate("/login", { replace: true, state: { registeredEmail: agency.email } })
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your agency account"
      subtitle="Track how AI recommends your clients"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? <ErrorBanner message={formError} /> : null}
        <Input
          label="Agency name"
          name="name"
          autoComplete="organization"
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          error={errors.name}
        />
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setField("email", e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setField("password", e.target.value)}
          error={errors.password}
          hint={!errors.password ? "At least 8 characters, with a letter and a digit" : undefined}
        />
        <Input
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => setField("confirmPassword", e.target.value)}
          error={errors.confirmPassword}
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
