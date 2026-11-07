import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanWebsiteSettings,WEBSITE_SETTING_DEFAULTS} from '../src/lib/websiteSettings.js';

test('website settings expose only validated public presentation values',()=>{
  const settings=cleanWebsiteSettings({
    siteTitle:' ChessArena Thesis ',accentColor:'#12abEF',defaultAppearance:'dark',defaultBoardTheme:'wood_2',
    siteDescription:' Nền tảng cờ vua cho khóa luận ',ownerName:' Nguyễn Văn A ',developerName:' Nhóm ChessArena ',
    supportEmail:'support@example.test',maintenanceMessage:'Scheduled maintenance',homepageAnnouncement:'Welcome',
    showMaintenanceBanner:true,jwtSecret:'must-not-survive',databaseUrl:'postgres://secret'
  });
  assert.deepEqual(Object.keys(settings).sort(),Object.keys(WEBSITE_SETTING_DEFAULTS).sort());
  assert.equal(settings.siteTitle,'ChessArena Thesis');assert.equal(settings.accentColor,'#12abEF');
  assert.equal(settings.siteDescription,'Nền tảng cờ vua cho khóa luận');
  assert.equal(settings.ownerName,'Nguyễn Văn A');assert.equal(settings.developerName,'Nhóm ChessArena');
  assert.equal(settings.showMaintenanceBanner,true);assert.equal(settings.jwtSecret,undefined);
});

test('website settings reject invalid support email and normalize unsafe values',()=>{
  assert.throws(()=>cleanWebsiteSettings({supportEmail:'not-an-email'}),/Email/);
  const settings=cleanWebsiteSettings({accentColor:'red',defaultAppearance:'unknown',defaultBoardTheme:'../bad theme'});
  assert.equal(settings.accentColor,WEBSITE_SETTING_DEFAULTS.accentColor);
  assert.equal(settings.defaultAppearance,'system');assert.equal(settings.defaultBoardTheme,'classic');
  assert.throws(()=>cleanWebsiteSettings({showMaintenanceBanner:true,maintenanceMessage:' '}),/bảo trì/);
});
