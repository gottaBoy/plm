-- Bind the interface administrator to the default organizational role and
-- remove the API-user role. The runtime explicitly rejects API users when
-- loading business application data.
-- Target database: a_lab01_3f9ebc219

INSERT INTO `sys_member` (
  `ID`,
  `CREATE_TIME`,
  `ORGANIZATIONAL_ROLE_ID`,
  `PERSON_ID`,
  `SORT`
) VALUES (
  'aibizhi-default-member',
  CURRENT_TIMESTAMP,
  '0000000000001',
  'aibizhi',
  1
) ON DUPLICATE KEY UPDATE
  `ORGANIZATIONAL_ROLE_ID` = VALUES(`ORGANIZATIONAL_ROLE_ID`),
  `PERSON_ID` = VALUES(`PERSON_ID`),
  `SORT` = VALUES(`SORT`);

DELETE FROM `sys_role_member`
WHERE `ID` = 'aibizhi'
  AND `ROLE_ID` = 'ROLE_APIUSERS'
  AND `MEMBER_UID` = 'aibizhi';

