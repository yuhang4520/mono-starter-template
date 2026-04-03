"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { usePathname } from "next/navigation";
import { Fragment, useMemo } from "react";
import { MenuItem } from "@/types/sidebar-menu";
import { menus } from "@/sidebar.config";

export function SiteHeader() {
  const pathname = usePathname();

  const activeMenuPaths = useMemo(
    () =>
      menus.reduce((prev, item) => {
        if (item.items?.length) {
          const subItem = item.items.find((subItem) =>
            subItem.asPrefix
              ? pathname.startsWith(subItem.href)
              : subItem.href === pathname
          );

          return subItem ? [item, subItem] : prev;
        }

        const hit = item.asPrefix
          ? pathname.startsWith(item.href)
          : item.href === pathname;
        return hit ? [item] : prev;
      }, Array<MenuItem>()),
    [pathname]
  );

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {activeMenuPaths.map((item, idx) => (
              <Fragment key={item.href}>
                {idx === activeMenuPaths.length - 1 ? (
                  <BreadcrumbItem>
                    <BreadcrumbPage>{item.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink>{item.title}</BreadcrumbLink>
                  </BreadcrumbItem>
                )}
                {idx != activeMenuPaths.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
