-- Stop application workers, then apply this to the portal database before
-- deploying the CoC active-employee code. Existing rows start inactive until
-- the new worker completes its first successful HR synchronization.
IF COL_LENGTH(N'coc.employees', N'is_active') IS NULL
BEGIN
  ALTER TABLE coc.employees
    ADD is_active bit NOT NULL
      CONSTRAINT DF_coc_employees_is_active DEFAULT (0) WITH VALUES
END

-- After the first sync, both sample former employees should have is_active = 0:
-- SELECT employee_id, is_active FROM coc.employees
-- WHERE employee_id IN (N'B15723', N'B16302');
