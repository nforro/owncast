import SOCKET_MESSAGE_TYPES from './chat/socketMessageTypes.js';

const KEY_USERNAME = 'owncast_username';
const KEY_AVATAR = 'owncast_avatar';
const KEY_CHAT_DISPLAYED = 'owncast_chat';
const KEY_CHAT_FIRST_MESSAGE_SENT = 'owncast_first_message_sent';
const CHAT_INITIAL_PLACEHOLDER_TEXT = 'Type here to chat, no account necessary.';
const CHAT_PLACEHOLDER_TEXT = 'Message';
const CHAT_PLACEHOLDER_OFFLINE = 'Chat is offline.';

class Message {
	constructor(model) {
		this.author = model.author;
		this.body = model.body;
		this.image = model.image || generateAvatar(model.author);
		this.id = model.id;
		this.type = model.type;
	}

	formatText() {
		showdown.setFlavor('github');
		var markdownToHTML = new showdown.Converter({
			emoji: true, 
			openLinksInNewWindow: true, 
			tables: false, 
			simplifiedAutoLink: false,
			literalMidWordUnderscores: true,
			strikethrough: true,
			ghMentions: false,
		}).makeHtml(this.body);
		const linked = autoLink(markdownToHTML, {
			embed: true,
			removeHTTP: true,
			linkAttr: {
				target: '_blank'
			}
		});
		const highlighted = this.highlightUsername(linked);
		return addNewlines(highlighted);
	}
	userColor() {
		return messageBubbleColorForString(this.author);
	}

	highlightUsername(message) {
		const username = document.getElementById('self-message-author').value;
		const pattern = new RegExp('@?' + username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
		return message.replace(pattern, '<span class="highlighted">$&</span>');
	}
}



class MessagingInterface {
	constructor() {
		this.chatDisplayed = false;
		this.username = '';
		this.messageCharCount = 0;
		this.maxMessageLength = 500;
		this.maxMessageBuffer = 20;
		this.chatUsernames = [];

		this.onReceivedMessages = this.onReceivedMessages.bind(this);
		this.disableChat = this.disableChat.bind(this);
		this.enableChat = this.enableChat.bind(this);
	}

	init() {
		this.tagAppContainer = document.getElementById('app-container');
		this.tagChatToggle = document.getElementById('chat-toggle');
		this.tagUserInfoChanger = document.getElementById('user-info-change');
		this.tagUsernameDisplay = document.getElementById('username-display');
		this.tagMessageFormWarning = document.getElementById('message-form-warning');

		this.inputMessageAuthor = document.getElementById('self-message-author');
		this.inputChangeUserName = document.getElementById('username-change-input'); 

		this.btnUpdateUserName = document.getElementById('button-update-username'); 
		this.btnCancelUpdateUsername = document.getElementById('button-cancel-change'); 
		this.btnSubmitMessage = document.getElementById('button-submit-message');

		this.formMessageInput = document.getElementById('message-body-form');

		this.imgUsernameAvatar = document.getElementById('username-avatar');
		this.textUserInfoDisplay = document.getElementById('user-info-display');

		this.scrollableMessagesContainer = document.getElementById('messages-container');

		// add events
		this.tagChatToggle.addEventListener('click', this.handleChatToggle.bind(this));
		this.textUserInfoDisplay.addEventListener('click', this.handleShowChangeNameForm.bind(this));
		
		this.btnUpdateUserName.addEventListener('click', this.handleUpdateUsername.bind(this));
		this.btnCancelUpdateUsername.addEventListener('click', this.handleHideChangeNameForm.bind(this));
		
		this.inputChangeUserName.addEventListener('keydown', this.handleUsernameKeydown.bind(this));
		this.formMessageInput.addEventListener('keydown', this.handleMessageInputKeydown.bind(this));
		this.formMessageInput.addEventListener('keyup', this.handleMessageInputKeyup.bind(this));
		this.formMessageInput.addEventListener('blur', this.handleMessageInputBlur.bind(this));
		this.btnSubmitMessage.addEventListener('click', this.handleSubmitChatButton.bind(this));

		this.initLocalStates();

		if (hasTouchScreen()) {
			setVHvar();
			window.addEventListener("orientationchange", setVHvar);
			this.tagAppContainer.classList.add('touch-screen');
		}
	}

	initLocalStates() {
		this.username = getLocalStorage(KEY_USERNAME) || generateUsername();
		this.imgUsernameAvatar.src =
			getLocalStorage(KEY_AVATAR) || generateAvatar(`${this.username}${Date.now()}`);
		this.updateUsernameFields(this.username);

		this.chatDisplayed = getLocalStorage(KEY_CHAT_DISPLAYED) || true;
		this.displayChat();
		this.disableChat(); // Disabled by default.
	}

	updateUsernameFields(username) {
		this.tagUsernameDisplay.innerText = username;
		this.inputChangeUserName.value = username;
		this.inputMessageAuthor.value = username;
	}

	displayChat() {
		if (this.chatDisplayed) {
			this.tagAppContainer.classList.add('chat');
			this.tagAppContainer.classList.remove('no-chat');
			jumpToBottom(this.scrollableMessagesContainer);
		} else {
			this.tagAppContainer.classList.add('no-chat');
			this.tagAppContainer.classList.remove('chat');
		}
		this.setChatPlaceholderText();
	}

	
	handleChatToggle() {
		this.chatDisplayed = !this.chatDisplayed;
		if (this.chatDisplayed) {
			setLocalStorage(KEY_CHAT_DISPLAYED, this.chatDisplayed);
		} else {
			clearLocalStorage(KEY_CHAT_DISPLAYED);
		}
		this.displayChat();
	}

	handleShowChangeNameForm() {
		this.textUserInfoDisplay.style.display = 'none';
		this.tagUserInfoChanger.style.display = 'flex';
		if (document.body.clientWidth < 640) {
			this.tagChatToggle.style.display = 'none';
		}
	}

	handleHideChangeNameForm() {
		this.textUserInfoDisplay.style.display = 'flex';
		this.tagUserInfoChanger.style.display = 'none';
		if (document.body.clientWidth < 640) {
			this.tagChatToggle.style.display = 'inline-block';
		}
	}

	handleUpdateUsername() {
		const oldName = this.username;
		var newValue = this.inputChangeUserName.value;
		newValue = newValue.trim();
		// do other string cleanup?

		if (newValue) {
			this.username = newValue;
			this.updateUsernameFields(newValue);
			this.imgUsernameAvatar.src = generateAvatar(`${newValue}${Date.now()}`);
			setLocalStorage(KEY_USERNAME, newValue);
			setLocalStorage(KEY_AVATAR, this.imgUsernameAvatar.src);
		}
		this.handleHideChangeNameForm();

		if (oldName !== newValue) {
			this.sendUsernameChange(oldName, newValue, this.imgUsernameAvatar.src);
		}
	}

	handleUsernameKeydown(event) {
		if (event.keyCode === 13) { // enter
			this.handleUpdateUsername();
		} else if (event.keyCode === 27) { // esc
			this.handleHideChangeNameForm();
		}
	}

	sendUsernameChange(oldName, newName, image) {
		const nameChange = {
			type: SOCKET_MESSAGE_TYPES.NAME_CHANGE,
			oldName: oldName,
			newName: newName,
			image: image,
		};

		this.send(nameChange);
	}

	tryToComplete() {
		const rawValue = this.formMessageInput.value;
		const position = this.formMessageInput.selectionStart;
		const at = rawValue.lastIndexOf('@', position - 1);

		if (at === -1) {
			return false;
		}

		var partial = rawValue.substring(at + 1, position).trim();

		if (partial === this.suggestion) {
			partial = this.partial;
		} else {
			this.partial = partial;
		}

		const possibilities = this.chatUsernames.filter(function (username) {
			return username.toLowerCase().startsWith(partial.toLowerCase());
		});

		if (this.completionIndex === undefined || ++this.completionIndex >= possibilities.length) {
			this.completionIndex = 0;
		}

		if (possibilities.length > 0) {
			this.suggestion = possibilities[this.completionIndex];

			this.formMessageInput.value = rawValue.substring(0, at + 1) + this.suggestion + ' ' + rawValue.substring(position);
			this.formMessageInput.selectionStart = at + this.suggestion.length + 2;
			this.formMessageInput.selectionEnd = this.formMessageInput.selectionStart;
		}

		return true;
	}

	handleMessageInputKeydown(event) {
		var okCodes = [37,38,39,40,16,91,18,46,8];
		var value = this.formMessageInput.value.trim();
		var numCharsLeft = this.maxMessageLength - value.length;
		if (event.keyCode === 13) { // enter
			if (!this.prepNewLine) {
				this.submitChat(value);
				event.preventDefault();
				this.prepNewLine = false;
				
				return;
			}
		}
		if (event.keyCode === 16 || event.keyCode === 17) { // ctrl, shift
			this.prepNewLine = true;
		}
		if (event.keyCode === 9) { // tab
			if (this.tryToComplete()) {
				event.preventDefault();

				// value could have been changed, update variables
				value = this.formMessageInput.value.trim();
				numCharsLeft = this.maxMessageLength - value.length;
			}
		}

		if (numCharsLeft <= this.maxMessageBuffer) {
			this.tagMessageFormWarning.innerText = `${numCharsLeft} chars left`;
			if (numCharsLeft <= 0 && !okCodes.includes(event.keyCode)) {
				event.preventDefault();
				return;
			}
		} else {
			this.tagMessageFormWarning.innerText = '';
		}
	}

	handleMessageInputKeyup(event) {
		if (event.keyCode === 16 || event.keyCode === 17) { // ctrl, shift
			this.prepNewLine = false;
		}
	}

	handleMessageInputBlur(event) {
		this.prepNewLine = false;
	}

	handleSubmitChatButton(event) {
		var value = this.formMessageInput.value.trim();
		if (value) {
			this.submitChat(value);
			event.preventDefault();
		return false;
		}
		event.preventDefault();
		return false;
	}

	submitChat(content) {
		if (!content) {
			return;
		}
		var message = new Message({
			body: content,
			author: this.username,
			image: this.imgUsernameAvatar.src,
			type: SOCKET_MESSAGE_TYPES.CHAT,
		});
		this.send(message);

		// clear out things.
		this.formMessageInput.value = '';
		this.tagMessageFormWarning.innerText = '';

		const hasSentFirstChatMessage = getLocalStorage(KEY_CHAT_FIRST_MESSAGE_SENT);
		if (!hasSentFirstChatMessage) {
			setLocalStorage(KEY_CHAT_FIRST_MESSAGE_SENT, true);
			this.setChatPlaceholderText();
		}
	}

	disableChat() {
		if (this.formMessageInput) {
			this.formMessageInput.disabled = true;
			this.formMessageInput.placeholder = CHAT_PLACEHOLDER_OFFLINE;
		}
	}
	enableChat() {
		if (this.formMessageInput) {
			this.formMessageInput.disabled = false;
			this.setChatPlaceholderText();
		}
	}

	setChatPlaceholderText() {
		const hasSentFirstChatMessage = getLocalStorage(KEY_CHAT_FIRST_MESSAGE_SENT);
		this.formMessageInput.placeholder = hasSentFirstChatMessage ? CHAT_PLACEHOLDER_TEXT : CHAT_INITIAL_PLACEHOLDER_TEXT
	}

	// handle Vue.js message display
	onReceivedMessages(newMessages, oldMessages) {
		// update the list of chat usernames
		newMessages.slice(oldMessages.length).forEach(function (message) {
			var username;

			switch (message.type) {
				case SOCKET_MESSAGE_TYPES.CHAT:
					username = message.author;
					break;

				case SOCKET_MESSAGE_TYPES.NAME_CHANGE:
					username = message.newName;
					break;

				default:
					return;
			}

			if (!this.chatUsernames.includes(username)) {
				this.chatUsernames.push(username);
			}
		}, this);

		if (newMessages.length !== oldMessages.length) {
			// jump to bottom
			jumpToBottom(this.scrollableMessagesContainer);
		}
	}

	send(messageJSON) {
		console.error('MessagingInterface send() is not linked to the websocket component.');
	}
}

export { Message, MessagingInterface }