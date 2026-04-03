import { Icon } from "@tabler/icons-react";

export type MenuItem = {
  title: string;
  href: string;
  icon?: Icon;
  roles?: string[];
  items?: MenuItem[];
  asPrefix?: boolean;
};
