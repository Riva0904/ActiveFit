import React from 'react';
import MessagesScreen from '../screens/chat/MessagesScreen';
import ChatContactsScreen from '../screens/chat/ContactsScreen';
import DirectChatScreen from '../screens/chat/DirectChatScreen';
import CreateGroupScreen from '../screens/chat/CreateGroupScreen';
import GroupChatScreen from '../screens/chat/GroupChatScreen';
import GroupInfoScreen from '../screens/chat/GroupInfoScreen';

/**
 * The chat stack, registered identically in every shell that has messages.
 *
 * Returned as an array rather than a fragment because React Navigation reads
 * `Screen` elements from the navigator's children — an array is flattened, and
 * this keeps the six screens in one place instead of copied into four files.
 *
 * `mainName` differs only because the staff shell mounts Messages as its own tab
 * ("MessagesMain") while the others reach it from Profile ("Messages").
 */
export function chatScreens(Stack: any, mainName = 'Messages') {
  return [
    <Stack.Screen key="messages" name={mainName} component={MessagesScreen} />,
    <Stack.Screen key="contacts" name="ChatContacts" component={ChatContactsScreen} />,
    <Stack.Screen key="direct" name="DirectChat" component={DirectChatScreen} />,
    <Stack.Screen key="create-group" name="CreateGroup" component={CreateGroupScreen} />,
    <Stack.Screen key="group" name="GroupChat" component={GroupChatScreen} />,
    <Stack.Screen key="group-info" name="GroupInfo" component={GroupInfoScreen} />,
  ];
}
