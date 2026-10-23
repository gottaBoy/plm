-- Seed representative internal role accounts for the local PLM deployment.
-- Passwords intentionally use the local demo default (123456); replace them
-- before any non-local or production use.
-- Target database: a_lab01_3f9ebc219

INSERT INTO `sys_person` (
  `ID`,
  `DISPLAY_NAME`,
  `ENABLED`,
  `CREATOR`,
  `CREATE_TIME`,
  `UID`,
  `USER_PASSWORD`,
  `ORGANIZATION_ID`,
  `EMPLOYEE_NUMBER`,
  `DESCRIPTION`,
  `STATUS`
) VALUES
  ('internal_superadmin', '超级管理员', 1, 'SYSTEM', CURRENT_TIMESTAMP, 'internal_superadmin', '207CF410532F92A47DEE245CE9B11FF71F578EBD763EB3BBEA44EBD043D018FB', '000000', 'internal_superadmin', '内部权限模板：全站超级管理员', '1'),
  ('internal_sysadmin', '系统管理员', 1, 'SYSTEM', CURRENT_TIMESTAMP, 'internal_sysadmin', '207CF410532F92A47DEE245CE9B11FF71F578EBD763EB3BBEA44EBD043D018FB', '000000', 'internal_sysadmin', '内部权限模板：系统与组织管理', '1'),
  ('internal_product_admin', '产品管理员', 1, 'SYSTEM', CURRENT_TIMESTAMP, 'internal_product_admin', '207CF410532F92A47DEE245CE9B11FF71F578EBD763EB3BBEA44EBD043D018FB', '000000', 'internal_product_admin', '内部权限模板：产品域管理', '1'),
  ('internal_project_admin', '项目管理员', 1, 'SYSTEM', CURRENT_TIMESTAMP, 'internal_project_admin', '207CF410532F92A47DEE245CE9B11FF71F578EBD763EB3BBEA44EBD043D018FB', '000000', 'internal_project_admin', '内部权限模板：项目域管理', '1'),
  ('internal_user', '普通用户', 1, 'SYSTEM', CURRENT_TIMESTAMP, 'internal_user', '207CF410532F92A47DEE245CE9B11FF71F578EBD763EB3BBEA44EBD043D018FB', '000000', 'internal_user', '内部权限模板：普通业务用户', '1'),
  ('internal_audit_reader', '审计只读用户', 1, 'SYSTEM', CURRENT_TIMESTAMP, 'internal_audit_reader', '207CF410532F92A47DEE245CE9B11FF71F578EBD763EB3BBEA44EBD043D018FB', '000000', 'internal_audit_reader', '内部权限模板：审计/外部协作入口', '1')
ON DUPLICATE KEY UPDATE
  `DISPLAY_NAME` = VALUES(`DISPLAY_NAME`),
  `ENABLED` = 1,
  `UID` = VALUES(`UID`),
  `USER_PASSWORD` = VALUES(`USER_PASSWORD`),
  `ORGANIZATION_ID` = VALUES(`ORGANIZATION_ID`),
  `EMPLOYEE_NUMBER` = VALUES(`EMPLOYEE_NUMBER`),
  `DESCRIPTION` = VALUES(`DESCRIPTION`),
  `STATUS` = '1';

INSERT INTO `sys_member` (
  `ID`,
  `CREATE_TIME`,
  `ORGANIZATIONAL_ROLE_ID`,
  `PERSON_ID`,
  `SORT`
) VALUES
  ('internal_superadmin-default-member', CURRENT_TIMESTAMP, '0000000000001', 'internal_superadmin', 1),
  ('internal_sysadmin-default-member', CURRENT_TIMESTAMP, '0000000000001', 'internal_sysadmin', 1),
  ('internal_product_admin-default-member', CURRENT_TIMESTAMP, '0000000000001', 'internal_product_admin', 1),
  ('internal_project_admin-default-member', CURRENT_TIMESTAMP, '0000000000001', 'internal_project_admin', 1),
  ('internal_user-default-member', CURRENT_TIMESTAMP, '0000000000001', 'internal_user', 1),
  ('internal_audit_reader-default-member', CURRENT_TIMESTAMP, '0000000000001', 'internal_audit_reader', 1)
ON DUPLICATE KEY UPDATE
  `ORGANIZATIONAL_ROLE_ID` = VALUES(`ORGANIZATIONAL_ROLE_ID`),
  `PERSON_ID` = VALUES(`PERSON_ID`),
  `SORT` = VALUES(`SORT`);

INSERT INTO `sys_role_member` (
  `ID`,
  `CREATOR`,
  `CREATE_TIME`,
  `ROLE_ID`,
  `MEMBER_TYPE`,
  `MEMBER_UID`,
  `MEMBER_NAME`
) VALUES
  ('internal_superadmin-superadmin', 'SYSTEM', CURRENT_TIMESTAMP, 'ROLE_SUPERADMIN', 'inetOrgPerson', 'internal_superadmin', '超级管理员'),
  ('internal_sysadmin-author-admin', 'SYSTEM', CURRENT_TIMESTAMP, 'e74b7e8c844d234bc14730de0d092955', 'inetOrgPerson', 'internal_sysadmin', '系统管理员'),
  ('internal_product_admin-product-admin', 'SYSTEM', CURRENT_TIMESTAMP, '57b4831c0596ce93229c7a5a6972b1ff', 'inetOrgPerson', 'internal_product_admin', '产品管理员'),
  ('internal_project_admin-project-admin', 'SYSTEM', CURRENT_TIMESTAMP, '2249f34fad5a4e735eac7c4ffa95fca9', 'inetOrgPerson', 'internal_project_admin', '项目管理员'),
  ('internal_user-users', 'SYSTEM', CURRENT_TIMESTAMP, 'ROLE_USERS', 'inetOrgPerson', 'internal_user', '普通用户'),
  ('internal_audit_reader-users', 'SYSTEM', CURRENT_TIMESTAMP, 'ROLE_USERS', 'inetOrgPerson', 'internal_audit_reader', '审计只读用户')
ON DUPLICATE KEY UPDATE
  `ROLE_ID` = VALUES(`ROLE_ID`),
  `MEMBER_TYPE` = VALUES(`MEMBER_TYPE`),
  `MEMBER_UID` = VALUES(`MEMBER_UID`),
  `MEMBER_NAME` = VALUES(`MEMBER_NAME`);

DELETE FROM `sys_role_member`
WHERE `MEMBER_UID` IN (
  'internal_superadmin',
  'internal_sysadmin',
  'internal_product_admin',
  'internal_project_admin',
  'internal_user',
  'internal_audit_reader'
)
AND NOT (
  (`MEMBER_UID` = 'internal_superadmin' AND `ROLE_ID` = 'ROLE_SUPERADMIN')
  OR (`MEMBER_UID` = 'internal_sysadmin' AND `ROLE_ID` = 'e74b7e8c844d234bc14730de0d092955')
  OR (`MEMBER_UID` = 'internal_product_admin' AND `ROLE_ID` = '57b4831c0596ce93229c7a5a6972b1ff')
  OR (`MEMBER_UID` = 'internal_project_admin' AND `ROLE_ID` = '2249f34fad5a4e735eac7c4ffa95fca9')
  OR (`MEMBER_UID` = 'internal_user' AND `ROLE_ID` = 'ROLE_USERS')
  OR (`MEMBER_UID` = 'internal_audit_reader' AND `ROLE_ID` = 'ROLE_USERS')
);
