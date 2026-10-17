import { createFileRoute } from "@tanstack/react-router";
import { DeskApp } from "@/components/desk/desk-app";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    if (search.embed === true || search.embed === "1") return { embed: true as const };
    return {};
  },
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  return <DeskApp embed={"embed" in search && search.embed === true} />;
}
