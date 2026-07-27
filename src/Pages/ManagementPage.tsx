import * as React from "react";
import { useState } from "react";
import { Shield, Users, FlaskConical, TestTube2 } from "lucide-react";
import { RolesSection } from "./management/RolesSection";
import { UsersSection } from "./management/UsersSection";
import { LaboratoriesSection } from "./management/LaboratoriesSection";
import { AnalysesSection } from "./management/AnalysesSection";

type TabId = "roles" | "users" | "laboratories" | "analyses";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "roles", label: "Rollar", icon: Shield },
  { id: "users", label: "Foydalanuvchilar", icon: Users },
  { id: "laboratories", label: "Laboratoriyalar", icon: FlaskConical },
  { id: "analyses", label: "Analizlar", icon: TestTube2 },
];

export function ManagementPage({ primaryColor }: { primaryColor: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("roles");

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-border overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" style={active ? { color: primaryColor } : undefined} />
                {tab.label}
                {active && (
                  <span
                    className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full"
                    style={{ background: primaryColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "roles" && <RolesSection primaryColor={primaryColor} />}
      {activeTab === "users" && <UsersSection primaryColor={primaryColor} />}
      {activeTab === "laboratories" && <LaboratoriesSection primaryColor={primaryColor} />}
      {activeTab === "analyses" && <AnalysesSection primaryColor={primaryColor} />}
    </main>
  );
}
