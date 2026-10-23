-- Seed business-domain memberships for the internal role template accounts.
-- Product/project admins manage existing business objects; the audit account
-- receives read-only membership. Normal users remain scoped by explicit
-- product/project membership.
-- Target database: plm

INSERT INTO `product_member` (
  `ID`,
  `CREATE_MAN`,
  `CREATE_TIME`,
  `NAME`,
  `PRODUCT_ID`,
  `ROLE_ID`,
  `UPDATE_MAN`,
  `UPDATE_TIME`,
  `USER_ID`
)
SELECT
  CONCAT('internal_product_admin-', `product`.`ID`),
  'SYSTEM',
  CURRENT_TIMESTAMP,
  '产品管理员',
  `product`.`ID`,
  'admin',
  'SYSTEM',
  CURRENT_TIMESTAMP,
  'internal_product_admin'
FROM `product`
WHERE `product`.`IS_DELETED` = 0
  AND `product`.`IS_ARCHIVED` = 0
ON DUPLICATE KEY UPDATE
  `ROLE_ID` = 'admin',
  `UPDATE_MAN` = 'SYSTEM',
  `UPDATE_TIME` = CURRENT_TIMESTAMP;

INSERT INTO `project_member` (
  `ID`,
  `CREATE_MAN`,
  `CREATE_TIME`,
  `NAME`,
  `PROJECT_ID`,
  `ROLE_ID`,
  `UPDATE_MAN`,
  `UPDATE_TIME`,
  `USER_ID`
)
SELECT
  CONCAT('internal_project_admin-', `project`.`ID`),
  'SYSTEM',
  CURRENT_TIMESTAMP,
  '项目管理员',
  `project`.`ID`,
  'admin',
  'SYSTEM',
  CURRENT_TIMESTAMP,
  'internal_project_admin'
FROM `project`
WHERE `project`.`IS_DELETED` = 0
  AND `project`.`IS_ARCHIVED` = 0
ON DUPLICATE KEY UPDATE
  `ROLE_ID` = 'admin',
  `UPDATE_MAN` = 'SYSTEM',
  `UPDATE_TIME` = CURRENT_TIMESTAMP;

INSERT INTO `product_member` (
  `ID`,
  `CREATE_MAN`,
  `CREATE_TIME`,
  `NAME`,
  `PRODUCT_ID`,
  `ROLE_ID`,
  `UPDATE_MAN`,
  `UPDATE_TIME`,
  `USER_ID`
)
SELECT
  CONCAT('internal_audit_reader-', `product`.`ID`),
  'SYSTEM',
  CURRENT_TIMESTAMP,
  '审计只读用户',
  `product`.`ID`,
  'reader',
  'SYSTEM',
  CURRENT_TIMESTAMP,
  'internal_audit_reader'
FROM `product`
WHERE `product`.`IS_DELETED` = 0
  AND `product`.`IS_ARCHIVED` = 0
ON DUPLICATE KEY UPDATE
  `ROLE_ID` = 'reader',
  `UPDATE_MAN` = 'SYSTEM',
  `UPDATE_TIME` = CURRENT_TIMESTAMP;

INSERT INTO `project_member` (
  `ID`,
  `CREATE_MAN`,
  `CREATE_TIME`,
  `NAME`,
  `PROJECT_ID`,
  `ROLE_ID`,
  `UPDATE_MAN`,
  `UPDATE_TIME`,
  `USER_ID`
)
SELECT
  CONCAT('internal_audit_reader-', `project`.`ID`),
  'SYSTEM',
  CURRENT_TIMESTAMP,
  '审计只读用户',
  `project`.`ID`,
  'reader',
  'SYSTEM',
  CURRENT_TIMESTAMP,
  'internal_audit_reader'
FROM `project`
WHERE `project`.`IS_DELETED` = 0
  AND `project`.`IS_ARCHIVED` = 0
ON DUPLICATE KEY UPDATE
  `ROLE_ID` = 'reader',
  `UPDATE_MAN` = 'SYSTEM',
  `UPDATE_TIME` = CURRENT_TIMESTAMP;

DELETE FROM `product_member`
WHERE `USER_ID` IN ('internal_product_admin', 'internal_audit_reader')
  AND NOT EXISTS (
    SELECT 1
    FROM `product`
    WHERE `product`.`ID` = `product_member`.`PRODUCT_ID`
      AND `product`.`IS_DELETED` = 0
      AND `product`.`IS_ARCHIVED` = 0
  );

DELETE FROM `project_member`
WHERE `USER_ID` IN ('internal_project_admin', 'internal_audit_reader')
  AND NOT EXISTS (
    SELECT 1
    FROM `project`
    WHERE `project`.`ID` = `project_member`.`PROJECT_ID`
      AND `project`.`IS_DELETED` = 0
      AND `project`.`IS_ARCHIVED` = 0
  );
