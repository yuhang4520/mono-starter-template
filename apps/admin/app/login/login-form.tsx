"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { useExtracted } from "next-intl";
import LanguageSwitcher from "@/components/language-switcher";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  type LoginFormValues = {
    phone: string;
    password: string;
  };

  const t = useExtracted();
  const router = useRouter();
  const { handleSubmit, control } = useForm<LoginFormValues>();

  const onSubmit: SubmitHandler<LoginFormValues> = async (values) => {
    await authClient.signIn.phoneNumber({
      phoneNumber: values.phone,
      password: values.password,
      fetchOptions: {
        onError(context) {
          toast.error(context.error.message, { position: "bottom-center" });
        },
        onSuccess() {
          router.replace("/");
        },
      },
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{t("Login to your account")}</CardTitle>
          <CardDescription>
            {t("Enter your phone number below to login to your account")}
          </CardDescription>
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
                    <FieldLabel htmlFor="phone">{t("Phone number")}</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>+86 </InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput id="phone" type="tel" {...field} />
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
                      <FieldLabel htmlFor="password">
                        {t("Password")}
                      </FieldLabel>
                      <a
                        href="#"
                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                      >
                        {t("Forgot your password?")}
                      </a>
                    </div>
                    <Input id="password" type="password" required {...field} />
                  </Field>
                )}
              />
              <Field>
                <Button type="submit">{t("Login")}</Button>
                <FieldDescription className="text-center">
                  {t("Don't have an account?")}{" "}
                  <a href="/signup">{t("Sign up")}</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
