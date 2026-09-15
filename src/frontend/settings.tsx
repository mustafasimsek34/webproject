import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import ForgeReconciler, { Button, EmptyState, Heading, HelperMessage, Label, SectionMessage, Spinner, Stack, Text, Textfield, UserPicker } from '@forge/react';
import type { UserPickerValue } from '@forge/react';
import { localeFromContext, setAppLocale, t } from '../shared/i18n';
import { openExport } from './components/exportNavigation';
import { useInvoke } from './components/useInvoke';

type SettingsValue = { complianceManagerUserIds: string[]; complianceManagerGroupIds: string[] };

export default function Settings() {
	const [settings, setSettings] = useState<SettingsValue>({ complianceManagerUserIds: [], complianceManagerGroupIds: [] });
	const [groupDraft, setGroupDraft] = useState('');
	const [ready, setReady] = useState(false);
	const getSettings = useInvoke<SettingsValue, { data: null }>('getSettings');
	const saveSettings = useInvoke<SettingsValue, { data: SettingsValue }>('saveSettings');

	useEffect(() => {
		void view.getContext().then((context) => {
			setAppLocale(localeFromContext(context as { locale?: string; localId?: string }));
			void getSettings.run({ data: null }).then((result) => {
				if (result?.ok) setSettings(result.data);
				setReady(true);
			});
		});
	}, [getSettings.run]);

	if (!ready || getSettings.loading) return <Spinner size="large" />;
	if (getSettings.code === 'FORBIDDEN') return <EmptyState header={t('forbiddenAdmin')} description={getSettings.error} />;
	if (getSettings.error) return <SectionMessage appearance="error"><Text>{getSettings.error}</Text></SectionMessage>;

	const save = async () => {
		const result = await saveSettings.run({ data: settings });
		if (result?.ok) setSettings({
			complianceManagerUserIds: result.data.complianceManagerUserIds,
			complianceManagerGroupIds: result.data.complianceManagerGroupIds
		});
	};

	const updateUsers = (value: UserPickerValue) => {
		const selected = Array.isArray(value) ? value : [value];
		setSettings({ ...settings, complianceManagerUserIds: selected.map((item) => item.id).filter(Boolean) });
	};

	const addGroup = () => {
		const next = groupDraft.trim();
		if (!next || settings.complianceManagerGroupIds.includes(next)) return;
		setSettings({ ...settings, complianceManagerGroupIds: [...settings.complianceManagerGroupIds, next] });
		setGroupDraft('');
	};

	return (
		<Stack space="space.200">
			<Heading size="large">{t('settingsTitle')}</Heading>
			<UserPicker
				key={settings.complianceManagerUserIds.join(',')}
				label={t('complianceManagerUsers')}
				name="complianceManagerUsers"
				isMulti
				defaultValue={settings.complianceManagerUserIds}
				onChange={updateUsers}
				placeholder={t('identityPickerPlaceholder')}
			/>
			<Label labelFor="manager-groups">{t('complianceManagerGroups')}</Label>
			<Text>{settings.complianceManagerGroupIds.length ? settings.complianceManagerGroupIds.join(', ') : t('groupsPlaceholder')}</Text>
			<Textfield id="manager-groups" value={groupDraft} placeholder={t('groupsPlaceholder')} onChange={(event) => setGroupDraft(event.target.value)} />
			<Button onClick={addGroup}>{t('add')}</Button>
			<HelperMessage>{t('settingsBody')}</HelperMessage>
			{saveSettings.error ? <SectionMessage appearance="error"><Text>{saveSettings.error}</Text></SectionMessage> : null}
			<Button appearance="primary" isDisabled={saveSettings.loading} onClick={() => void save()}>{t('save')}</Button>
			<Stack space="space.050">
				<Button onClick={() => void openExport({})}>{t('exportAll')}</Button>
				<HelperMessage>{t('exportAllHint')}</HelperMessage>
			</Stack>
			<SectionMessage appearance="warning" title={t('lifecycleTitle')}>
				<Text>{t('lifecycleNotice')}</Text>
			</SectionMessage>
		</Stack>
	);
}

ForgeReconciler.render(<Settings />);
