-- Target database: plm
-- Expand utf8 character storage without promoting TEXT/MEDIUMTEXT column types.
-- The caller must back up the selected business database before applying DDL.
-- Existing utf8mb4 columns and their explicit collations are preserved.

DELIMITER //

CREATE PROCEDURE aibiz_migrate_011_utf8mb4()
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_schema VARCHAR(64);
  DECLARE v_table VARCHAR(64);
  DECLARE v_collation VARCHAR(64);
  DECLARE v_columns LONGTEXT;
  DECLARE v_old_concat BIGINT UNSIGNED;
  DECLARE v_tables CURSOR FOR
    SELECT t.TABLE_NAME, t.TABLE_COLLATION
    FROM information_schema.TABLES t
    WHERE t.TABLE_SCHEMA = DATABASE()
      AND t.TABLE_TYPE = 'BASE TABLE'
      AND (
        LEFT(t.TABLE_COLLATION, 5) = 'utf8_'
        OR EXISTS (
          SELECT 1 FROM information_schema.COLUMNS c
          WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA
            AND c.TABLE_NAME = t.TABLE_NAME
            AND c.CHARACTER_SET_NAME = 'utf8'
        )
      )
    ORDER BY (t.TABLE_NAME = 'comment') DESC, t.TABLE_NAME;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET SESSION group_concat_max_len = v_old_concat;
    RESIGNAL;
  END;

  SET v_old_concat = @@SESSION.group_concat_max_len;
  SET v_schema = DATABASE();
  IF v_schema IS NULL OR v_schema IN ('mysql', 'sys', 'information_schema', 'performance_schema') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Select the PLM business database before migration';
  END IF;
  IF FIND_IN_SET('NO_BACKSLASH_ESCAPES', @@SESSION.sql_mode) > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Metadata quoting requires the standard MySQL SQL mode';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = v_schema OR UNIQUE_CONSTRAINT_SCHEMA = v_schema
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Foreign-key charset dependencies require a separate migration plan';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = v_schema AND CHARACTER_SET_NAME = 'utf8' AND EXTRA <> ''
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Generated or special character columns require a separate migration plan';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = v_schema AND c.CHARACTER_SET_NAME = 'utf8'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.COLLATIONS co
        WHERE co.COLLATION_NAME = CONCAT('utf8mb4', SUBSTRING(c.COLLATION_NAME, 5))
      )
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An existing collation has no matching utf8mb4 variant';
  END IF;

  SET SESSION group_concat_max_len = 16777216;
  ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

  OPEN v_tables;
  table_loop: LOOP
    FETCH v_tables INTO v_table, v_collation;
    IF v_done = 1 THEN
      LEAVE table_loop;
    END IF;
    SELECT GROUP_CONCAT(
      CONCAT('MODIFY COLUMN `', REPLACE(c.COLUMN_NAME, '`', '``'), '` ', c.COLUMN_TYPE,
        ' CHARACTER SET utf8mb4 COLLATE utf8mb4', SUBSTRING(c.COLLATION_NAME, 5),
        IF(c.IS_NULLABLE = 'YES', ' NULL', ' NOT NULL'),
        IF(c.COLUMN_DEFAULT IS NULL,
          IF(c.IS_NULLABLE = 'YES', ' DEFAULT NULL', ''),
          CONCAT(' DEFAULT ', QUOTE(c.COLUMN_DEFAULT))),
        ' COMMENT ', QUOTE(c.COLUMN_COMMENT))
      ORDER BY c.ORDINAL_POSITION SEPARATOR ', ')
      INTO v_columns
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = v_schema AND c.TABLE_NAME = v_table
      AND c.CHARACTER_SET_NAME = 'utf8';

    SET @aibiz_charset_sql = CONCAT('ALTER TABLE `', REPLACE(v_schema, '`', '``'),
      '`.`', REPLACE(v_table, '`', '``'), '` DEFAULT CHARACTER SET utf8mb4 COLLATE ',
      IF(LEFT(v_collation, 5) = 'utf8_', CONCAT('utf8mb4', SUBSTRING(v_collation, 5)), v_collation),
      IF(v_columns IS NULL, '', CONCAT(', ', v_columns)));
    PREPARE aibiz_charset_statement FROM @aibiz_charset_sql;
    EXECUTE aibiz_charset_statement;
    DEALLOCATE PREPARE aibiz_charset_statement;
  END LOOP;
  CLOSE v_tables;
  SET @aibiz_charset_sql = NULL;
  SET SESSION group_concat_max_len = v_old_concat;
END//

CALL aibiz_migrate_011_utf8mb4()//
DROP PROCEDURE aibiz_migrate_011_utf8mb4//

DELIMITER ;
