"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { generateCustomerEmail } from "@/lib/utils";
import { useExtracted } from "next-intl";

const formSchema = z
  .object({
    name: z.string().nonempty(),
    phone: z.string().regex(/^1\d{10}$/, "Phone number is invalid"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const t = useExtracted();
  const router = useRouter();

  const { handleSubmit, control } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = async (
    values
  ) => {
    await authClient.signUp.email({
      name: values.name,
      phoneNumber: values.phone,
      email: generateCustomerEmail(values.phone),
      password: values.password,
      displayUsername: values.name,
      username: values.phone,
      fetchOptions: {
        onError(ctx) {
          toast.error(ctx.error.message.replace("email", "phone number"), {
            position: "bottom-center",
          });
        },
        onSuccess() {
          router.replace("/");
        },
      },
    });
  };

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t("Create an account")}</CardTitle>
        <CardDescription>
          {t("Enter your information below to create your account")}
        </CardDescription>
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
                  <FieldLabel htmlFor="name">{t("Full Name")}</FieldLabel>
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
                  <FieldLabel htmlFor="phone">{t("Phone number")}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>+86 </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="phone" type="tel" {...field} />
                  </InputGroup>
                  <FieldDescription>
                    {fieldState.error?.message}
                  </FieldDescription>
                </Field>
              )}
            />
            <Controller
              control={control}
              name="password"
              defaultValue=""
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="password">{t("Password")}</FieldLabel>
                  <Input id="password" type="password" {...field} />
                  <FieldDescription>
                    {fieldState.error?.message}
                  </FieldDescription>
                </Field>
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              defaultValue=""
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    {t("Confirm Password")}
                  </FieldLabel>
                  <Input id="confirm-password" type="password" {...field} />
                  <FieldDescription>
                    {fieldState.error?.message}
                  </FieldDescription>
                </Field>
              )}
            />
            <FieldGroup>
              <Field>
                <Button type="submit">{t("Create Account")}</Button>
                <FieldDescription className="px-6 text-center">
                  {t("Already have an account?")}{" "}
                  <a href="/login">{t("Sign in")}</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
