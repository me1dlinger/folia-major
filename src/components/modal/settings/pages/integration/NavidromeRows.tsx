import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Button, Chips, Reveal, Row, Status, TextField, Toggle } from '../../kit';
import { useSettingsPage } from '../settingsPageContext';
import { NAVIDROME_HOME_SECTIONS } from '../../../../../library/core/home/navidrome/navidromeHomeModel';
import { useNavidromeUiSettingsStore } from '../../../../../stores/useNavidromeUiSettingsStore';
import { O } from './options';

// src/components/modal/settings/pages/integration/NavidromeRows.tsx
// The Navidrome rows of the 连接与集成 page: the switch, the server address and sign-in under it,
// and a last row that says whether a connection is saved and tests the one typed. The form is the
// settings dialog's own state; a test that succeeds is what saves it. Where a Docker deployment
// set a preset account, the last row says when it is the one in use and can go back to it.

export const NavidromeRows: React.FC = () => {
    const { t } = useTranslation();
    const {
        navidromeConfigured: configured,
        navidromeEnabled: enabled,
        navidromePassword: password,
        navidromeServerProfile: profile,
        navidromeTestStatus: testStatus,
        navidromeUrl: url,
        navidromeUsername: username,
        navidromeCanRestorePreset: canRestorePreset,
        navidromeRestoreFailed: restoreFailed,
        navidromeRestoring: restoring,
        navidromeUsesPreset: usesPreset,
        onRestoreNavidromePreset,
        onClearNavidrome,
        onToggleNavidrome,
        setNavidromePassword,
        setNavidromeUrl,
        setNavidromeUsername,
        testNavidromeConnection,
    } = useSettingsPage().viewProps.integration.navidrome;
    // 媒体库界面的两个只跟 Navidrome 有关的开关，直接读 store（不加进那套表单状态）。
    const navidromeUi = useNavidromeUiSettingsStore(useShallow(state => ({
        hiddenSections: state.hiddenSections,
        sectionsAsTracks: state.sectionsAsTracks,
        sectionTrackLimit: state.sectionTrackLimit,
        toggleSection: state.handleToggleHiddenSection,
        setSectionsAsTracks: state.handleToggleSectionsAsTracks,
        setSectionTrackLimit: state.handleSetSectionTrackLimit,
    })));
    const testing = testStatus === 'testing';
    // What is known about the saved connection: the server, the account, what the server offers,
    // and whether it is the deployment's preset account.
    const profileLine = [
        ...(configured && profile
            ? [
                profile.serverVersion || profile.serverType || t('navidrome.serverProfileUnavailable'),
                profile.user?.username || username,
                profile.openSubsonic ? `OpenSubsonic (${profile.openSubsonicExtensions.length})` : null,
                `${t('navidrome.musicFolders')} (${profile.musicFolders.length})`,
            ]
            : []),
        configured && usesPreset ? t('navidrome.usingServerPreset') : null,
    ].filter(Boolean).join(' · ') || undefined;

    return (
        <>
            <Row option={O.navidrome}>
                <Toggle checked={enabled} onChange={onToggleNavidrome} />
            </Row>
            <Reveal when={enabled}>
                <Row sub option={O.navidromeUrl}>
                    <TextField type="url" value={url} onChange={setNavidromeUrl} placeholder={t('navidrome.serverUrlPlaceholder')} />
                </Row>
                <Row sub option={O.navidromeUsername}>
                    <TextField value={username} onChange={setNavidromeUsername} />
                </Row>
                <Row sub option={O.navidromePassword}>
                    <TextField type="password" value={password} onChange={setNavidromePassword} placeholder={configured ? '••••••••' : undefined} />
                </Row>
                <Row
                    sub
                    label={testStatus === 'failed'
                        ? <Status tone="error">{t('navidrome.connectionFailed')}</Status>
                        : configured
                            ? <Status tone="ok">{t('navidrome.connectionSuccess')}</Status>
                            : <Status>{t('navidrome.notConfigured')}</Status>}
                    hint={profileLine}
                >
                    {configured && <Button onClick={onClearNavidrome}>{t('navidrome.clearSettings')}</Button>}
                    {canRestorePreset && (
                        <Button icon={RotateCcw} onClick={() => void onRestoreNavidromePreset()} disabled={restoring}>
                            {t('navidrome.restoreServerPreset')}
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        onClick={() => void testNavidromeConnection()}
                        disabled={testing || !url || !username || !password}
                    >
                        {testing ? t('navidrome.testing') : t('navidrome.testConnection')}
                    </Button>
                </Row>
                {canRestorePreset && restoreFailed && <Row sub notice={t('navidrome.restoreServerPresetFailed')} />}
                {/* 菜单项与「单曲列表」显示方式：只跟 Navidrome 有关的界面开关。 */}
                <Row sub option={O.navidromeSectionsAsTracks} note={t('options.navidromeSectionsAsTracksDesc')}>
                    <Toggle checked={navidromeUi.sectionsAsTracks} onChange={navidromeUi.setSectionsAsTracks} />
                </Row>
                <Row sub option={O.navidromeSectionTrackLimit} hint={t('options.navidromeSectionTrackLimitHint')} note={t('options.navidromeSectionTrackLimitDesc')}>
                    <TextField
                        value={String(navidromeUi.sectionTrackLimit)}
                        onChange={(value) => {
                            const parsed = Number(value);
                            if (Number.isFinite(parsed)) navidromeUi.setSectionTrackLimit(Math.max(1, Math.floor(parsed)));
                        }}
                    />
                </Row>
                <Row sub option={O.navidromeHiddenSections} hint={t('options.hiddenNavidromeSectionsHint')} note={t('options.hiddenNavidromeSectionsDesc')}>
                    <Chips
                        items={NAVIDROME_HOME_SECTIONS.map(entry => ({
                            id: entry.key,
                            label: t(entry.labelKey),
                            checked: !navidromeUi.hiddenSections.includes(entry.key),
                            onChange: (shown: boolean) => navidromeUi.toggleSection(entry.key, !shown),
                        }))}
                    />
                </Row>
            </Reveal>
        </>
    );
};

export default NavidromeRows;
