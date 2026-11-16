'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'
import z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { generateCustomerEmail } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const formSchema = z
  .object({
    name: z.string().nonempty(),
    phone: z.string().regex(/^1\d{10}$/, 'Phone number is invalid'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  })
  .refine(data => data.password === data.confirmPassword, {
    error: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const t = useTranslations('auth')
  const router = useRouter()

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = async values => {
    try {
      await authClient.signUp.email({
        name: values.name,
        phoneNumber: values.phone,
        email: generateCustomerEmail(values.phone),
        password: values.password,
        displayUsername: values.name,
        username: values.phone,
        fetchOptions: {
          onError(ctx) {
            toast.error((ctx.error.message ?? '注册失败').replace('email', 'phone number'), {
              position: 'bottom-center',
            })
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
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t('signupTitle')}</CardTitle>
        <CardDescription>{t('signupDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
          <FieldGroup>
            <Controller
              control={control}
              name="name"
              defaultValue=""
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="name">{t('name')}</FieldLabel>
                  <Input id="name" type="text" {...field} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="phone"
              defaultValue=""
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="phone">{t('phone')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>+86 </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="phone" type="tel" {...field} />
                  </InputGroup>
                  <FieldDescription>{fieldState.error?.message}</FieldDescription>
                </Field>
              )}
            />
            <Controller
              control={control}
              name="password"
              defaultValue=""
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                  <Input id="password" type="password" {...field} />
                  <FieldDescription>{fieldState.error?.message}</FieldDescription>
                </Field>
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              defaultValue=""
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="confirm-password">{t('confirmPassword')}</FieldLabel>
                  <Input id="confirm-password" type="password" {...field} />
                  <FieldDescription>{fieldState.error?.message}</FieldDescription>
                </Field>
              )}
            />
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '创建中…' : t('createAccount')}
                </Button>
                <FieldDescription className="px-6 text-center">
                  {t('hasAccount')} <a href="/login">{t('signin')}</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
