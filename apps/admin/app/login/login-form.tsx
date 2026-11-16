'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/language-switcher'

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  type LoginFormValues = {
    phone: string
    password: string
  }

  const t = useTranslations('auth')
  const router = useRouter()
  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>()

  const onSubmit: SubmitHandler<LoginFormValues> = async values => {
    try {
      await authClient.signIn.phoneNumber({
        phoneNumber: values.phone,
        password: values.password,
        fetchOptions: {
          onError(context) {
            toast.error(context.error.message, { position: 'bottom-center' })
          },
          onSuccess() {
            router.replace('/')
            router.refresh()
          },
        },
      })
    } catch {
      toast.error('网络异常，请稍后重试')
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{t('loginTitle')}</CardTitle>
          <CardDescription>{t('loginDescription')}</CardDescription>
          <CardAction>
            <LanguageSwitcher />
          </CardAction>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                control={control}
                name="phone"
                defaultValue=""
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="phone">{t('phone')}</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>+86 </InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="phone"
                        type="tel"
                        required
                        pattern="1[0-9]{10}"
                        autoComplete="username"
                        {...field}
                      />
                    </InputGroup>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="password"
                defaultValue=""
                render={({ field }) => (
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      {...field}
                    />
                  </Field>
                )}
              />
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '登录中…' : t('login')}
                </Button>
                <FieldDescription className="text-center">
                  {t('noAccount')} <a href="/signup">{t('signup')}</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
