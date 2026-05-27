import { NavLink, useLocation } from "react-router-dom";
import { LayoutGrid, ChefHat, Pizza, Star, Wine, LogOut, Utensils } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Tavoli", url: "/", icon: LayoutGrid },
  { title: "Cucina", url: "/kds/cucina", icon: ChefHat },
  { title: "Pizzeria", url: "/kds/pizzeria", icon: Pizza },
  { title: "Bar", url: "/kds/bar", icon: Wine },
  { title: "Menu", url: "/menu", icon: Utensils },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-gold grid place-items-center shrink-0 shadow-gold">
            <Star className="h-5 w-5 text-gold-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-sidebar-foreground truncate" style={{fontFamily:"'Playfair Display', serif"}}>Comande Pro</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Servizio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <NavLink to={item.url} end className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Esci</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
