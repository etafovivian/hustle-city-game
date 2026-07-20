-- Audit history is immutable (PRD: administrator actions require immutable audit entries).
CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();
--> statement-breakpoint
-- The City Coin ledger is append-only too; corrections are new entries.
CREATE OR REPLACE FUNCTION game_ledger_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'game_ledger_entries is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER game_ledger_no_update_delete
  BEFORE UPDATE OR DELETE ON game_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION game_ledger_block_mutation();
