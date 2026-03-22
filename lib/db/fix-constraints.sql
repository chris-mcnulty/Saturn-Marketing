DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'domain_blocklist_domain_key') THEN
    ALTER INDEX domain_blocklist_domain_key RENAME TO domain_blocklist_domain_unique;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'service_plans_name_key') THEN
    ALTER INDEX service_plans_name_key RENAME TO service_plans_name_unique;
  END IF;
END $$;
