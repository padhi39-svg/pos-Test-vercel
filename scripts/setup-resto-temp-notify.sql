CREATE OR REPLACE FUNCTION notify_resto_temp_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('resto_temp_changed', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resto_temp_changes ON resto_temp_orders;

CREATE TRIGGER trg_resto_temp_changes
AFTER INSERT OR UPDATE OR DELETE ON resto_temp_orders
FOR EACH STATEMENT
EXECUTE FUNCTION notify_resto_temp_changes();
