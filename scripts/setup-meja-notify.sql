CREATE OR REPLACE FUNCTION notify_meja_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('meja_changed', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meja_changes ON master_meja;

CREATE TRIGGER trg_meja_changes
AFTER INSERT OR UPDATE OR DELETE ON master_meja
FOR EACH STATEMENT
EXECUTE FUNCTION notify_meja_changes();
