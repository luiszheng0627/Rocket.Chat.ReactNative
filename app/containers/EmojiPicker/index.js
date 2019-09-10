import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ScrollView } from 'react-native';
import ScrollableTabView from 'react-native-scrollable-tab-view';
import { emojify } from 'react-emojione';
import equal from 'deep-equal';
import { connect } from 'react-redux';
import orderBy from 'lodash/orderBy';
import { sanitizedRaw } from '@nozbe/watermelondb/RawRecord';

import TabBar from './TabBar';
import EmojiCategory from './EmojiCategory';
import styles from './styles';
import categories from './categories';
import watermelondb from '../../lib/database';
import { emojisByCategory } from '../../emojis';
import protectedFunction from '../../lib/methods/helpers/protectedFunction';
import log from '../../utils/log';

const scrollProps = {
	keyboardShouldPersistTaps: 'always',
	keyboardDismissMode: 'none'
};

class EmojiPicker extends Component {
	static propTypes = {
		baseUrl: PropTypes.string.isRequired,
		customEmojis: PropTypes.object,
		onEmojiSelected: PropTypes.func,
		tabEmojiStyle: PropTypes.object,
		emojisPerRow: PropTypes.number,
		width: PropTypes.number
	};

	constructor(props) {
		super(props);
		// this.frequentlyUsed = database.objects('frequentlyUsedEmoji').sorted('count', true);
		const customEmojis = Object.keys(props.customEmojis)
			.filter(item => item === props.customEmojis[item].name)
			.map(item => ({
				content: props.customEmojis[item].name,
				extension: props.customEmojis[item].extension,
				isCustom: true
			}));
		this.state = {
			frequentlyUsed: [],
			customEmojis,
			show: false
		};
	}

	async componentDidMount() {
		await this.updateFrequentlyUsed();
		this.setState({ show: true });
	}

	shouldComponentUpdate(nextProps, nextState) {
		const { frequentlyUsed, show } = this.state;
		const { width } = this.props;
		if (nextState.show !== show) {
			return true;
		}
		if (nextProps.width !== width) {
			return true;
		}
		if (!equal(nextState.frequentlyUsed, frequentlyUsed)) {
			return true;
		}
		return false;
	}

	onEmojiSelected = (emoji) => {
		try {
			const { onEmojiSelected } = this.props;
			if (emoji.isCustom) {
				// const count = this._getFrequentlyUsedCount(emoji.content);
				this._addFrequentlyUsed({
					content: emoji.content, extension: emoji.extension, isCustom: true
				});
				onEmojiSelected(`:${ emoji.content }:`);
			} else {
				const content = emoji;
				// const count = this._getFrequentlyUsedCount(content);
				this._addFrequentlyUsed({ content, isCustom: false });
				const shortname = `:${ emoji }:`;
				onEmojiSelected(emojify(shortname, { output: 'unicode' }), shortname);
			}
		} catch (e) {
			log(e);
		}
	}

	// eslint-disable-next-line react/sort-comp
	_addFrequentlyUsed = protectedFunction(async(emoji) => {
		const watermelon = watermelondb.database;
		const freqEmojiCollection = watermelondb.database.collections.get('frequently_used_emojis');
		await watermelon.action(async() => {
			try {
				const freqEmojiRecord = await freqEmojiCollection.find(emoji.content);
				await freqEmojiRecord.update((f) => {
					f.count += 1;
				});
			} catch (error) {
				try {
					await freqEmojiCollection.create((f) => {
						f._raw = sanitizedRaw({ id: emoji.content }, freqEmojiCollection.schema);
						Object.assign(f, emoji);
						f.count = 1;
					});
				} catch (e) {
					// Do nothing
				}
			}
		});
	})

	updateFrequentlyUsed = async() => {
		const frequentlyUsedRecords = await watermelondb.database.collections.get('frequently_used_emojis').query().fetch();
		let frequentlyUsed = orderBy(frequentlyUsedRecords, ['count'], ['desc']);
		frequentlyUsed = frequentlyUsed.map((item) => {
			if (item.isCustom) {
				return { content: item.content, extension: item.extension, isCustom: item.isCustom };
			}
			return emojify(`${ item.content }`, { output: 'unicode' });
		});
		this.setState({ frequentlyUsed });
	}

	renderCategory(category, i) {
		const { frequentlyUsed, customEmojis } = this.state;
		const {
			emojisPerRow, width, baseUrl
		} = this.props;

		let emojis = [];
		if (i === 0) {
			emojis = frequentlyUsed;
		} else if (i === 1) {
			emojis = customEmojis;
		} else {
			emojis = emojisByCategory[category];
		}
		return (
			<EmojiCategory
				emojis={emojis}
				onEmojiSelected={emoji => this.onEmojiSelected(emoji)}
				style={styles.categoryContainer}
				size={emojisPerRow}
				width={width}
				baseUrl={baseUrl}
			/>
		);
	}

	render() {
		const { show, frequentlyUsed } = this.state;
		const { tabEmojiStyle } = this.props;

		if (!show) {
			return null;
		}
		return (
			<ScrollableTabView
				renderTabBar={() => <TabBar tabEmojiStyle={tabEmojiStyle} />}
				contentProps={scrollProps}
				style={styles.background}
			>
				{
					categories.tabs.map((tab, i) => (
						(i === 0 && frequentlyUsed.length === 0) ? null // when no frequentlyUsed don't show the tab
							: (
								<ScrollView
									key={tab.category}
									tabLabel={tab.tabLabel}
									style={styles.background}
									{...scrollProps}
								>
									{this.renderCategory(tab.category, i)}
								</ScrollView>
							)))
				}
			</ScrollableTabView>
		);
	}
}

const mapStateToProps = state => ({
	customEmojis: state.customEmojis
});

export default connect(mapStateToProps)(EmojiPicker);
