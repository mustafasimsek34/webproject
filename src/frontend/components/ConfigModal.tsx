import React, { useEffect, useState } from 'react';
import { Button, DatePicker, HelperMessage, Label, Lozenge, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, SectionMessage, Stack, Text, Textfield, Toggle, UserPicker } from '@forge/react';
import type { UserPickerValue } from '@forge/react';
import { PageConfig } from '../../shared/types';
import { t } from '../../shared/i18n';
import { useInvoke } from './useInvoke';

export function ConfigModal({
	open,
	pageId,
	spaceKey = '',
	onClose,
	onSaved
}: {
	open: boolean;
	pageId: string;
	spaceKey?: string;
	onClose: () => void;
	onSaved?: (config: PageConfig) => void;
}) {
	const [config, setConfig] = useState<PageConfig>();
	const [users, setUsers] = useState<string[]>([]);
	const [groups, setGroups] = useState<string[]>([]);
	const [groupDraft, setGroupDraft] = useState('');
	const [dueDate, setDueDate] = useState<string | null>(null);
	const [reconfirmOnChange, setReconfirmOnChange] = useState(false);
	const getConfig = useInvoke<PageConfig | undefined, { data: { pageId: string } }>('getConfig');
	const saveConfig = useInvoke<PageConfig, { data: PageConfig }>('saveConfig');

	useEffect(() => {
		if (!open || !pageId) return;
		void getConfig.run({ data: { pageId } }).then((result) => {
			if (!result?.ok) return;
			const loaded = result.data;
			setConfig(loaded);
			setUsers(loaded?.assignedUsers ?? []);
			setGroups(loaded?.assignedGroups ?? []);
			setDueDate(loaded?.dueDate ?? null);
			setReconfirmOnChange(loaded?.reconfirmOnChange ?? false);
		});
	}, [getConfig.run, open, pageId]);

	const updateUsers = (value: UserPickerValue) => {
		const selected = Array.isArray(value) ? value : [value];
		setUsers(selected.map((item) => item.id).filter(Boolean));
	};

	const addGroup = () => {
		const next = groupDraft.trim();
		if (!next || groups.includes(next)) return;
		setGroups([...groups, next]);
		setGroupDraft('');
	};

	const save = async () => {
		const next = {
			...(config ?? {}),
			pageId,
			active: true,
			spaceKey: config?.spaceKey ?? spaceKey,
			assignedUsers: users,
			assignedGroups: groups,
			dueDate: dueDate || '',
			reconfirmOnChange
		} as PageConfig;
		const result = await saveConfig.run({ data: next });
		if (result?.ok) {
			onSaved?.(result.data);
			onClose();
		}
	};

	if (!open) return null;
	const voluntary = users.length === 0 && groups.length === 0;

	return (
		<Modal onClose={onClose}>
			<ModalHeader><ModalTitle>{t('pageConfigTitle')}</ModalTitle></ModalHeader>
			<ModalBody>
				<Stack space="space.200">
					<Text>{t('whoMustConfirm')}</Text>
					<UserPicker
						key={users.join(',')}
						label={t('assignedUsers')}
						name="assignedUsers"
						isMulti
						defaultValue={users}
						onChange={updateUsers}
						placeholder={t('usersPlaceholder')}
					/>
					<Label labelFor="assigned-groups">{t('assignedGroups')}</Label>
					<Text>{groups.length ? groups.join(', ') : t('groupsPlaceholder')}</Text>
					<Textfield
						id="assigned-groups"
						value={groupDraft}
						placeholder={t('groupsPlaceholder')}
						onChange={(event) => setGroupDraft(event.target.value)}
					/>
					<Button onClick={addGroup}>{t('add')}</Button>
					<HelperMessage>{t('groupsHint')}</HelperMessage>
					<Label labelFor="due-date">{t('dueDate')}</Label>
					<Lozenge appearance="new">{t('v11')}</Lozenge>
					<DatePicker id="due-date" {...(dueDate ? { value: dueDate } : {})} isDisabled onChange={(value) => setDueDate(value || null)} />
					<Toggle isChecked={reconfirmOnChange} isDisabled label={`${t('reconfirmOnChange')} (${t('v11')})`} onChange={() => setReconfirmOnChange((value) => !value)} />
					{voluntary ? <SectionMessage appearance="information"><Text>{t('voluntaryNotice')}</Text></SectionMessage> : null}
					{getConfig.error ? <Text>{getConfig.error}</Text> : null}
					{saveConfig.error ? <Text>{saveConfig.error}</Text> : null}
				</Stack>
			</ModalBody>
			<ModalFooter>
				<Button onClick={onClose}>{t('cancel')}</Button>
				<Button appearance="primary" isDisabled={getConfig.loading || saveConfig.loading} onClick={() => void save()}>{t('save')}</Button>
			</ModalFooter>
		</Modal>
	);
}
