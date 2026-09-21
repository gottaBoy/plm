-- Seed the personal dashboard requested by the PLM web workspace.
-- Target database: plm, MySQL 5.7.

INSERT INTO `DYNADASHBOARD` (
  `APPID`,
  `CREATEDATE`,
  `CREATEMAN`,
  `DESC`,
  `DYNADASHBOARDID`,
  `DYNADASHBOARDNAME`,
  `EXAMPLE_CHART`,
  `IS_SYSTEM`,
  `MODEL`,
  `MODELID`,
  `OWNER_ID`,
  `OWNER_TYPE`,
  `SEQUENCES`,
  `TYPE`,
  `UPDATE_MAN`,
  `UPDATE_TIME`,
  `USERID`
) VALUES (
  'ibizplm__plmweb',
  CURRENT_TIMESTAMP,
  'demo_admin',
  NULL,
  'ibizplm__plmweb_dashboard_plmweb.recent_dashboard_demo_admin',
  '最近访问',
  NULL,
  0,
  '{"model":[],"colNum":12,"rowH":80,"config":{},"filter":{}}',
  'plmweb.recent_dashboard.dashboard',
  NULL,
  NULL,
  0,
  'personal',
  'demo_admin',
  CURRENT_TIMESTAMP,
  'demo_admin'
) ON DUPLICATE KEY UPDATE
  `APPID` = VALUES(`APPID`),
  `MODEL` = VALUES(`MODEL`),
  `MODELID` = VALUES(`MODELID`),
  `TYPE` = VALUES(`TYPE`),
  `UPDATE_MAN` = VALUES(`UPDATE_MAN`),
  `UPDATE_TIME` = VALUES(`UPDATE_TIME`),
  `USERID` = VALUES(`USERID`);
