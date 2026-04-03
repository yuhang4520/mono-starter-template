import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateCustomerEmail(phoneNumber: string) {
  return `${phoneNumber}@customer.example.local`;
}

/**
 * Check given role in allowed roles
 *
 * @param allowed allowed roles
 * @param role composite user role token
 * @returns
 */
export function containsRole(allowed: string[] | undefined, role: string) {
  if (allowed === undefined) {
    return true;
  }

  const [userRole] = role.split(":", 2);

  return allowed.includes(role) || allowed.includes(userRole);
}
