-- CreateTable
CREATE TABLE "FocusArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "angle" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusArea_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "focusAreaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FocusArea_name_key" ON "FocusArea"("name");

-- CreateIndex
CREATE INDEX "Topic_focusAreaId_status_idx" ON "Topic"("focusAreaId", "status");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_focusAreaId_fkey" FOREIGN KEY ("focusAreaId") REFERENCES "FocusArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed presets: the subject areas previously hard-coded in the topic generation prompt.
INSERT INTO "FocusArea" ("id", "name", "angle", "active", "weight", "isPreset", "updatedAt") VALUES
    ('preset_accessibility', 'Accessibility', 'ARIA, focus, keyboard, and screen reader mechanics. Avoid generic checklists.', true, 1, true, CURRENT_TIMESTAMP),
    ('preset_browser_internals', 'Browser internals', 'Rendering, layout, event loop, and DOM behavior explained from the browser''s point of view.', true, 1, true, CURRENT_TIMESTAMP),
    ('preset_css', 'CSS', 'Layout, cascade, containment, and modern CSS features with real production tradeoffs.', true, 1, true, CURRENT_TIMESTAMP),
    ('preset_react_architecture', 'React architecture', 'Component boundaries, state, server components, and design system composition.', true, 1, true, CURRENT_TIMESTAMP),
    ('preset_frontend_performance', 'Frontend performance', 'Budgets, input latency, hydration, and why performance symptoms mislead.', true, 1, true, CURRENT_TIMESTAMP),
    ('preset_ai_ux', 'AI UX', 'Interfaces for AI features and reviewing AI-generated UI. Concrete mechanisms, not generic AI takes.', true, 1, true, CURRENT_TIMESTAMP),
    ('preset_debugging', 'Debugging', 'Debugging stories and review models for subtle frontend bugs.', true, 1, true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
