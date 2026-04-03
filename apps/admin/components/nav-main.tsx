"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { MenuItem } from "@/types/sidebar-menu";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { containsRole } from "@/lib/utils";
import { menus } from "@/sidebar.config";

export function NavMain({ role }: { role: string }) {
  const pathname = usePathname();
  const visibileMenus = useMemo(
    () =>
      menus.reduce((prev, item) => {
        const visible = containsRole(item.roles, role);

        if (!visible) {
          return prev;
        }

        if (item.items === undefined) {
          return prev.concat(item);
        }

        const items = item.items.filter((item) =>
          containsRole(item.roles, role)
        );
        if (items?.length) {
          return prev.concat({ ...item, items });
        }

        return prev;
      }, Array<MenuItem>()),
    [role]
  );

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {visibileMenus.map((item) =>
            item.items?.length ? (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={item.items.some((e) =>
                  e.asPrefix ? pathname.startsWith(e.href) : e.href === pathname
                )}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            isActive={
                              subItem.asPrefix
                                ? pathname.startsWith(subItem.href)
                                : subItem.href === pathname
                            }
                            asChild
                          >
                            <Link href={subItem.href}>
                              {subItem.icon && <subItem.icon />}
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={item.href === pathname}
                  asChild
                >
                  <Link href={item.href}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
