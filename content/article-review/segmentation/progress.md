# JSON 句段审核进度（2026-10-07）

本轮已登记全文通读与复核 1054/1054 篇；待审 0 篇，待确认 120 篇。全部1054篇逐篇审核登记完成；共677篇调整句段，934篇通过，120篇保留边界待确认，因此完整验收仍不通过。并行审阅决定在复核后由主进程串行发布，未发布的决定不计入下表。

|课程|总篇数|实际修改篇数|无修改通过|已修改通过|待确认|待审|
|---|---:|---:|---:|---:|---:|---:|
|水木|192|181|11|152|29|0|
|研究生|40|6|33|6|1|0|
|新概念|276|275|1|275|0|0|
|人教|313|54|256|51|6|0|
|大学英语|72|0|72|0|0|0|
|四六级|97|97|0|32|65|0|
|考研|64|64|0|45|19|0|

实际修改篇数包含已修改通过及做了确定部分修复、仍有待确认边界的文章，因此与状态列不应相加。120篇待确认中116篇已修复可确定部分，4篇保留原样；不存在未通读的待审文章。

## 已验证范围

- 示例061指定七块准确合为四块，全文摘要、题干、选项及解析均复核，33处合并有记录。
- 12项本轮定向测试、20项原审核工具测试、6项恢复检查测试通过。新增跨页范围重分段、发布中断后恢复、重复执行不追加重复事件测试，并拒绝不合规证据字段。
- 最终检查结果见 [verification.json](verification.json)；逐篇相对于本轮发布基线的非空白文字、顺序、元数据及字幕保护结果见 [baseline-verification.json](baseline-verification.json)。
- 全程只使用lesson JSON及审核代码/快照，未读取PDF、图片或教材，未做前端修改。
- 历史台账与恢复报告保留；历史通过状态不计为本轮全文审核。

## 待确认边界

位置均指决定中保留的审核前JSON；具体前后内容、哈希和上下文理由见逐篇决定及关联修订。文字错误只记notes，不在此扩大校勘范围。

- [水木 beginner-006](decisions/shuimu/beginner-006.json)：blocks[64..68] 名词分类图含“名 普”“词 通”等拆散列文字；仅凭 JSON 无法可靠恢复树形分组，保留原行，待确认。
- [水木 beginner-021](decisions/shuimu/beginner-021.json)：blocks[78..79] third 被放在简称 1st, 2nd, 3rd 后，JSON 无法只用空白修复列顺序，保留。；blocks[83..84] 口诀末字“序”位于 twenty first 21st 之后，不重排字符，保留待确认。
- [水木 beginner-026](decisions/shuimu/beginner-026.json)：blocks[15..18] 英文在 Tuesday, 后插入中文半句，再续 Wednesday；中文也被英文续句隔开。需要跨语言重排才可各自成句，本轮保留字符顺序，不修复。
- [水木 beginner-027](decisions/shuimu/beginner-027.json)：blocks[7..10] 电话次数的英中半句交替，合为完整英中段落需重排字符，本轮保留。；blocks[79..84] 物主代词表列头被词形列隔开（形容词性物/主代词，名词性物主/代词），仅凭空白改动无法恢复列序，保留待确认。
- [水木 beginner-030](decisions/shuimu/beginner-030.json)：blocks[13..16] tea or coffee 与 and we haven't 之间插入译文；blocks[21..24] tomatoes 与 but we've got 之间插入译文。完整英中段落需跨语言重排，本轮不改变字符顺序。
- [水木 beginner-032](decisions/shuimu/beginner-032.json)：blocks[119..120] forecast 的过去式/分词两列被拆为 forecast forecast/ forecast/ 与 forecasted forecasted；合并无法恢复列内词序，不重排，待确认。
- [水木 beginner-036](decisions/shuimu/beginner-036.json)：blocks[27..30] 预付定金句英文和中文均在逗号后被对方语言打断；完整英中段落需字符重排，保留待确认。
- [水木 beginner-038](decisions/shuimu/beginner-038.json)：blocks[3..6] 英文 ago, 到 but I forgot 的中间插入中文，中文也被英语隔开；需要跨语言重排，本轮保留原顺序。
- [水木 beginner-041](decisions/shuimu/beginner-041.json)：blocks[3..6] When 时间从句与主句之间插入中文；blocks[17..22] 时间从句、主句及引语的英中交替切断中文句子，需要重排字符，本轮保留。
- [水木 beginner-047](decisions/shuimu/beginner-047.json)：原始 blocks[12:16] I said...six o'clock,/中文/ but the boss.../中文，以及 blocks[32:36] telephone engineer/中文/and I'm repairing.../中文，跨语言重排超出仅空白修复范围。
- [水木 beginner-048](decisions/shuimu/beginner-048.json)：原始blocks[16:20] After the train...and/火车开出站后…/took out her powder compact./拿出了粉盒，完成双语句段需重排非空白字符。
- [水木 beginner-049](decisions/shuimu/beginner-049.json)：原始blocks[6:10] On Sundays...our town/中文/and to walk through the woods./中文，需重排方可合成完整英汉段落，超出本轮范围。
- [水木 intermediate-004](decisions/shuimu/intermediate-004.json)：原始blocks[20..23] visited与a great number之间、[24..27] gone to与Alice Springs之间插入中文半句；完整英汉段落需字符重排。
- [水木 intermediate-005](decisions/shuimu/intermediate-005.json)：原始blocks[25..28] police与that thieves从句之间、[29..33] main building与while others之间有中文半句，合完整英汉段需字符重排，保留待确认。
- [水木 intermediate-008](decisions/shuimu/intermediate-008.json)：原始blocks[26..29] Tony said,后中文插入，so now续话及其中文又成两块；恢复完整发言的双语单元需要字符重排，原序保留。
- [水木 intermediate-013](decisions/shuimu/intermediate-013.json)：原始blocks[128..134] 虚拟条件表‘与现在事实相反的/假设’等标签被谓语形式隔开，‘动词原/形’跨列错位，空白和段落操作不能复原各列，保留待确认。
- [水木 intermediate-016](decisions/shuimu/intermediate-016.json)：原始blocks[15..19] Last year机场启用的中文放在后一英文‘Over a hundred people’之后，英汉对应需字符重排。；原始blocks[179..180] 最后注释止于‘等的主动语态’，JSON没有后续谓语；只能合并现有两行，不能补写结尾，待确认。
- [水木 intermediate-033](decisions/shuimu/intermediate-033.json)：原blocks[135..147]虚拟条件句表格主句/从句列交错，should/would/could/might与各形式关系无法只改段界恢复，保留待确认；其余全文已修复复核。
- [水木 intermediate-060](decisions/shuimu/intermediate-060.json)：blocks[49..50]：摘要连接词who/whether与第1点Doctors operated--mummy: Egyptian woman交错，whether插在名词修饰续行之前。仅合段无法恢复连接词列且不能重排字符，保留待确认。
- [水木 intermediate-063](decisions/shuimu/intermediate-063.json)：blocks[54..55]：连接词and插在第1点killed a / guard之间，属于摘要列交错；仅凭当前字符顺序不能恢复，保留待确认。
- [水木 intermediate-070](decisions/shuimu/intermediate-070.json)：blocks[53..54]：摘要连接词because插入seventeen / hours短语，连接词列与内容列交错。边界无法仅靠不重排字符的合并恢复，保留待确认。
- [水木 upper-001](decisions/shuimu/upper-001.json)：blocks[176]在完整选择题答案后只有孤立的1.，JSON无后续内容，无法确认它是新解析条目还是残留标记；未猜测合并或删除。
- [水木 upper-002](decisions/shuimu/upper-002.json)：blocks[172]为孤立heading：2.1【故事精讲】An unknown goddess，出现在本课答案之后且无后续正文；仅凭本JSON无法判定跨课标题归属，不删除或移动。
- [水木 upper-003](decisions/shuimu/upper-003.json)：blocks[186]为下一故事The double life of Alfred Bloggs的孤立标题，位于本课答案后且无该故事正文；跨课标题归属不能仅靠当前JSON空白调整确定。
- [水木 upper-004](decisions/shuimu/upper-004.json)：末尾block181孤立出现下一课标题4.1【故事精讲】The facts，缺乏对应正文；跨课边界无法仅凭当前JSON确认，保留待核。
- [水木 upper-044](decisions/shuimu/upper-044.json)：词表blocks[7..8]、[14..15]、[29..30]有前一词条中文解释尾部夹在后一词条释义后的现象（列车分隔间、单调的、不可避免地），无法仅通过空白或保持顺序的分块恢复各自完整独立词条，需确认内容归属；现状保留。
- [水木 upper-049](decisions/shuimu/upper-049.json)：课外练习第4题blocks[185..186]中(a)结尾in every后断开，respect嵌在(b)的she与gave之间；仅调整空白或保序分块不能恢复两个独立完整选项，保持原状待确认。
- [水木 upper-053](decisions/shuimu/upper-053.json)：末尾blocks[234..241]从新的Try to answer指令、桃树保护问题到insect/entranced/wage/beetle/contaminate词表，明显切换至下一课主题，却没有当前课内标题归属；不能仅靠空白或保序分块确定课程间边界，保持尾部内容待确认。
- [水木 upper-054](decisions/shuimu/upper-054.json)：篇首blocks[0..19]直接从sheltered词条开始，无本课导读/问题/Vocabulary标题；上一课053尾部含桃树问题与insect等前五词条。当前两课边界截断同一词表，需课程归属确认，无法仅本文件空白修复，现状保留。
- [研究生 volume2-07](decisions/postgraduate/volume2-07.json)：blocks[12..22]题名转为The beauty industry美容业，无法仅据现有JSON确定是否为本课有意附文；不擅自跨文件重排，需确认内容归属。
- [人教 pephs3-030](decisions/pep-english/pephs3-030.json)：末尾穆旦引诗现为一行 Quietly, we embrace In a world lit up by words.；In在句中大写，可能丢失诗行边界，仅凭JSON不能确定，未猜测另加诗内换行。
- [人教 pephs4-021](decisions/pep-english/pephs4-021.json)：全文将科幻说明与性别语言词表/练习交叉穿插，如artificial与intelligence间夹chairman policeman chairperson；后文亦持续双内容交织且句尾截断。需重排或补字才可恢复句段，超出只调空白边界权限。
- [人教 pephs4-025](decisions/pep-english/pephs4-025.json)：首段以pass by.起始，缺少主语及句首，且标题也是In the film...near截断句；仅凭该JSON无法确认首段应从何处接续，不能仅靠空白恢复完整首段。
- [人教 pephs4-026](decisions/pep-english/pephs4-026.json)：myself my time burn tidy等练习词组与person who can provide explanations...及岩画段连续交叉插入，例句亦与岩画年代交织。恢复词表、例句与说明自然段需要重排，无法仅调空白安全修复。
- [人教 pephs4-029](decisions/pep-english/pephs4-029.json)：首段从outside.句尾起始且标题为同一截断片段，无法仅凭本JSON补全首句或确定缺失的首段边界。
- [人教 pephs4-032](decisions/pep-english/pephs4-032.json)：Charles Babbage等人物问答与母船Deep Sea No.1及survey深海任务两条内容逐片交织，恢复独立题干和段落需要重排非空白字符，无法在本次权限内安全修复。
- [四六级 cet4-20181201](decisions/cet/cet4-20181201.json)：原blocks[5..6]：听力Section B指令在Answer Sheet 1 / with a single line间插有带NUL的页码标记；不删除或重排非空白字符无法续成完整指令，已隔离页码并保留续行待确认。
- [四六级 cet4-20190601](decisions/cet/cet4-20190601.json)：原blocks[0..1]听力第6/7、8..10、12..15选项出现列交错：第6题D插在第7题中；8..10和12..15的C/D成组落在后题乃至Section C之后。已按现有标签各选项独立成块，但不允许重排非空白字符，无法恢复各题完整选项归属顺序，待确认。
- [四六级 cet4-20191201](decisions/cet/cet4-20191201.json)：blocks[0..2]听力3/4、5..7、8..11、12..15、16..18、24/25及blocks[5]48/49选项跨题交错，只能拆界不能调序归题。；blocks[0..1]Section B说明和blocks[3..4]段F续句中夹有非空白页脚，无法仅凭空白恢复连续语句；blocks[2]开头e ram…与20题选项倒置。
- [四六级 cet4-20191202](decisions/cet/cet4-20191202.json)：blocks[0..2]听力3/4、5..7、8..11、12..15、17/18、20/21及22..25选项跨题错列；blocks[5..6]47/48、51..53、54/55同样交错，保持现有字序并逐项分块。；blocks[3..4]段H引语及blocks[5..6]海蛞蝓using hijacked句中夹入非空白页码，仅改空白不能恢复正常连续语句。
- [四六级 cet4-20191203](decisions/cet/cet4-20191203.json)：blocks[1..2]段G的high-tech underground及blocks[3..4]微波炉And the problem is growing跨页句中夹入非空白页脚，不能保序仅改空白恢复完整句。
- [四六级 cet4-20201201](decisions/cet/cet4-20201201.json)：blocks[0..2]听力5..7、8..10、12..14、19..21选项跨题交错，8..11及22..25说明尾句也插在选项后，仅改边界无法归位。；blocks[2..3]half of all administrative以及blocks[5..6]studies have shown句中含非空白页码，无法仅改空白保序恢复连续句。
- [四六级 cet4-20201202](decisions/cet/cet4-20201202.json)：blocks[0..2]听力1/2、8..11、14/15、19/20、22..25选项跨题交错；3/4说明尾句及3A的mainland分离且夹在其他题后，无法保序归位。；blocks[2..3]praise人称句、[3..4]贫困E、[4..5]O、[5..6]combat boredom及[6..7]Throughout history句内插入非空白页码，保持分离待确认。
- [四六级 cet4-20201203](decisions/cet/cet4-20201203.json)：blocks[1..2]饭盒J段节目名单The Partridge Family与the Addams Family之间夹非空白页码，已隔离页码，无法仅改空白恢复完整引语。
- [四六级 cet4-20210601](decisions/cet/cet4-20210601.json)：blocks[1..2]12..15、22..25选项与分部标题跨列交错；blocks[3]词库E/F之间插入Section B标题，保序分开仍不能正确归位。；blocks[3..4]abilities-are related及blocks[6..7]cope with technological句中含非空白页脚，不能仅改边界恢复完整续句。
- [四六级 cet4-20210602](decisions/cet/cet4-20210602.json)：blocks[0]写作字数说明at least 180 words./words but no more than原次序缺损，不能仅靠空白还原；听力1/2及blocks[2]24/25选项跨题和标题交错。；blocks[2..3]to exercise、[3..4]they demonstrate、[4..5]ancient Mesopotamia、[5..6]Guidelines which、[6..7]balance work句中夹非空白页脚，无法保序仅改空白恢复续句。
- [四六级 cet4-20210603](decisions/cet/cet4-20210603.json)：blocks[1..2]attrition among scientists及blocks[4..5]there is evidence跨页句夹非空白页码，已分离标识，不能保序改空白恢复完整句。
- [四六级 cet4-20211201](decisions/cet/cet4-20211201.json)：blocks[0]听力3/4选项跨题交错，保留字序无法归位。；blocks[1..2]through the centre、[4..5]on the internet、[6..7]heated cleaned句内夹页脚；[5..6]L段跨页虽为句界但含页脚且原句末标点缺失，保留分离。
- [四六级 cet4-20211202](decisions/cet/cet4-20211202.json)：blocks[6..7]as having a disease句内被非空白页脚打断，已分离页脚，无法仅改空白保持顺序恢复完整句。
- [四六级 cet4-20211203](decisions/cet/cet4-20211203.json)：blocks[2..3]teens’ smartphones及blocks[5..6]Building on these findings被非空白页脚打断，无法仅用空白保序恢复完整句，已隔离标识。
- [四六级 cet4-20220601](decisions/cet/cet4-20220601.json)：blocks[1]听力9..11选项跨题交错，无法保序归位。；blocks[4..5]公司文化E段don’t worry句中夹有页码乱码，仅改空白不能完整恢复连续句。
- [四六级 cet4-20220900](decisions/cet/cet4-20220900.json)：blocks[4..5]兔子效应G段the expectations were that句中插非空白页码乱码，无法仅改空白保序恢复完整句，已分离标识。
- [四六级 cet4-20221201](decisions/cet/cet4-20221201.json)：听力1/2、5/6/7、12至15、19至21及若干阅读题选项按双栏交织（A/B先于其他题C/D；24题及阅读46至50为A/C/B/D），仅改空白不能重排到所属题目。；原blocks2末至3首孤独研究、4末至5首大学费用L段、5末至6首饮食段被页尾乱码插入句中；非空白乱码不能删除或移位，因此保留跨块片段并待确认完整段界。
- [四六级 cet4-20221202](decisions/cet/cet4-20221202.json)：听力1/2、3/4、6/7、8/9、12至18题存在不同题目A/B与C/D交织；19、24题为A/C/B/D顺序，无法仅空白调整恢复通常选项排列。；原block2末至3首父母幸福段、3末至4首拒绝C段、4末至5首I段、6末至7首粮食援助段被页尾乱码插入句中；保留片段并待确认，不能删除/移位乱码。
- [四六级 cet4-20221203](decisions/cet/cet4-20221203.json)：原block1末至2首E匹配段、block2末至3首第39题以及block4末至5首饮食价格段，均被不可删除的页尾乱码隔断句中；仅空白不能恢复完整自然段，需确认。
- [四六级 cet4-20230300](decisions/cet/cet4-20230300.json)：听力8至17、19至21等题目双栏选项跨题交织；4至6、22/24/25与阅读47/48/50/53至55选项A/C/B/D原顺序无法只用空白改为通常排列。；婚后姓氏匹配D段跨原blocks3/4、K段跨4/5时有页码页眉乱码插在句中；不能保序恢复完整段落，保留片段待确认。
- [四六级 cet4-20230601](decisions/cet/cet4-20230601.json)：棉制品选词原blocks7/8、语音网络F段10/11、雄心文章15/16跨页句中插入页码页眉；不能移除非空白页眉，故句段仍被隔断，需确认。
- [四六级 cet4-20230602](decisions/cet/cet4-20230602.json)：F1匹配H段跨原blocks5/6时页眉插在what we all / think of句中；仅空白不能移除或移动页眉，段落仍受干扰需确认。
- [四六级 cet4-20230603](decisions/cet/cet4-20230603.json)：舞狮匹配F段跨原blocks6/7，for the / coming year之间插有页眉，无法只用空白恢复完整段落；保留原字符顺序并待确认。
- [四六级 cet4-20231201](decisions/cet/cet4-20231201.json)：听力8至15、20/21及22至25题A/B与其他题C/D交织，不能只用空白重新归题。；运动选词block2末/3首、气候匹配E段3末/4首、忙碌阅读5末/6首、机票研究6末/7首均有页码页脚插入句中，保留被截片段待确认。
- [四六级 cet4-20231202](decisions/cet/cet4-20231202.json)：听力5至7的C/D先于A/B且被Section B及页脚分隔，8至11、13至15和22至25有跨题选项交织；不能保序归为各完整题。；爱好选词2/3、陪产假P段4/5、创业竞争5/6、多任务科学家说明6/7均被页脚截在句中，不能只改空白恢复完整段界，需确认。
- [四六级 cet4-20231203](decisions/cet/cet4-20231203.json)：青少年社交网络E段原blocks1/2跨页被页脚分隔，M段blocks2/3在their / phones之间插入页脚；仅空白不能去除页脚恢复完整段，需确认。
- [四六级 cet4-20240601](decisions/cet/cet4-20240601.json)：科研资助阅读原block15末的more likely与17首to end up之间插入独立页码网址block16；不能删移非空白内容，完整句段边界需确认。
- [四六级 cet4-20240603](decisions/cet/cet4-20240603.json)：雪天停课F匹配段在原block3末local school与block5首superintendents之间插入block4页码网址，不能只调整空白恢复完整段界，需确认。
- [四六级 cet6-20180601](decisions/cet/cet6-20180601.json)：原blocks[2]末尾psychologist Margo与blocks[3]开头Gardner之间夹有非空白页码\u0000- \u00003\u0000 \u0000-；仅空白操作无法恢复姓名及连续句，保留页码独立块和续文待确认。；原blocks[3]末尾educators instead took与blocks[4]开头advantage之间夹有非空白页码；句中边界不能越过页码合并，待确认。；原blocks[4]末尾new territory,与blocks[5]开头says Serrat之间夹有非空白页码；引述归属句中边界不能越过页码合并，待确认。
- [四六级 cet6-20180602](decisions/cet/cet6-20180602.json)：blocks[2]末while与blocks[3]celebrating中间夹第4页；不能越页码恢复连续句。；blocks[3]Hale选词段的issued a 33 the holiday.／setting aside...for The true authorship与段末35 of片段，原顺序无法只调空白获得明确句段，保留待确认。；blocks[4]末squeeze more cash与blocks[5]out of之间夹第6页，不能越页码合句。；blocks[5]末whom the与blocks[6]machine之间夹第7页，不能越页码合句。；blocks[6]末graduation now与blocks[7]approaches之间夹第8页，不能越页码合句。
- [四六级 cet6-20180603](decisions/cet/cet6-20180603.json)：原blocks[1]末asked me about my与blocks[2]educational background之间夹第3页；严格保留非空白原序无法恢复这句，保留页码独立与续句待确认。
- [四六级 cet6-20181201](decisions/cet/cet6-20181201.json)：原blocks[2]末a multitude与blocks[3]of invasive species之间有非空白页码3，无法仅调空白恢复连续句。；原blocks[3]末Keith与blocks[4]says之间有非空白页码4，无法仅调空白恢复引述句。；原blocks[4]第38题son’s与blocks[5]perspective之间有非空白页码5，无法仅调空白恢复题干。
- [四六级 cet6-20181202](decisions/cet/cet6-20181202.json)：原blocks[3]末Dr. Etheridge与blocks[4]are digging之间夹页码4，无法仅以空白恢复连续主谓句。；原blocks[4]末demanded to与blocks[5]be well treated之间夹页码5，无法仅以空白恢复引述句。；原blocks[6]末RIKEN-TRI与blocks[7]Collaboration Center之间夹页码7，无法仅以空白恢复机构名称及连续句。
- [四六级 cet6-20190601](decisions/cet/cet6-20190601.json)：原blocks[3]末going与blocks[4]the way之间夹页码4，无法仅空白恢复连续句。；原blocks[6]末biggest event与blocks[7]in the history之间夹页码7，无法仅空白恢复Hawking引语。；原blocks[7]末by next与blocks[8]year之间夹页码8，无法仅空白恢复市场预测句。
- [四六级 cet6-20190602](decisions/cet/cet6-20190602.json)：原blocks[4]末offering与blocks[5]repair之间夹页码5，无法只调空白恢复句子。；原blocks[5]末from the与blocks[6]inside之间夹页码6，无法只调空白恢复句子。；原blocks[6]末reports that与blocks[7]the industry之间夹页码7，无法只调空白恢复宾语从句。
- [四六级 cet6-20190603](decisions/cet/cet6-20190603.json)：原blocks[0]末their weight与blocks[1]破折号by replacing之间夹页码1，无法只调空白完整续接原句。；原blocks[1]末attain与blocks[2]more distant orbits之间夹页码2，无法只调空白完整续接原句。；原blocks[2]末organizations与blocks[3]that之间夹页码3，无法只调空白完整续接定语从句。；原blocks[3]末questions or与blocks[4]unfinished statements之间夹页码4，无法只调空白完整续接说明。；原blocks[5]末his place be与blocks[6]in a world之间夹页码6，无法只调空白完整续接问句。
- [四六级 cet6-20191201](decisions/cet/cet6-20191201.json)：原blocks[4]末causing all the与blocks[5]problems.)之间夹完整重复页眉2019年12月大学英语六级考试真题（一） - 6 -；无法只调空白恢复括号内连续句。
- [四六级 cet6-20191202](decisions/cet/cet6-20191202.json)：原blocks[7]末environmental non-governmental与blocks[8]organisations之间夹完整2019年12月大学英语六级考试真题（二） - 9 -页眉；非空白原序约束下不能合回连续引语句。
- [四六级 cet6-20191203](decisions/cet/cet6-20191203.json)：原blocks[24]末young people与blocks[26]especially之间夹blocks[25]完整第5页页眉，无法仅空白恢复句子。；原blocks[28]末has enough与blocks[30]land之间夹blocks[29]完整第6页页眉，无法仅空白恢复句子。
- [四六级 cet6-20200901](decisions/cet/cet6-20200901.json)：原block[0]第3题D选项位于第4题B选项后，非空白顺序限制下无法恢复各题完整分组。；原block[2]22—25题C/D选项均位于阅读标题之后，与前面的A/B隔开，需重排才可恢复题目边界。；原blocks[3..4]with / which person之间夹第4页页码，句子不能仅空白续接。；原blocks[4..5]36题from / birth之间夹第5页页码，题干不能仅空白续接。；原blocks[5..6]private / sector之间夹第6页页码，句子不能仅空白续接。；原blocks[6..7]criticisms of the / plan之间夹第7页页码，句子不能仅空白续接。
- [四六级 cet6-20200902](decisions/cet/cet6-20200902.json)：原blocks[1..2]doctor who / can't listen之间夹控制字符页脚，无法只调空白恢复连续句。；原block[5]翻译主体全为乱码，5.30至5.31的原换行无法从语义确认句段关系，保留该边界待可读文本确认。
- [四六级 cet6-20201201](decisions/cet/cet6-20201201.json)：原block[1]第9—11题先排列全部A/B后才列C/D，无法仅用空白恢复每题完整选项分组。；原block[1]第16—18、20—21题C/D选项提前位于Section C标题前，与后方对应A/B隔开，需重排才能恢复各题边界。
- [四六级 cet6-20201202](decisions/cet/cet6-20201202.json)：原block[0]第1题C/D位于第2题A后、第3题C/D位于第4题C后、第7题D位于第8题D后，恢复各题分组需重排。；原blocks[2..3]strike of / 1980之间夹页码26，无法只改空白恢复句子。；原blocks[3..4]saved / by a new Hercules之间夹页码27，无法只改空白恢复句子。；原blocks[6..7]The point / is that之间夹页码30，无法只改空白恢复句子。
- [四六级 cet6-20201203](decisions/cet/cet6-20201203.json)：原blocks[18..19]contributes / to negative thoughts之间夹7x^2020^12^ 50页码，无法仅空白恢复连续句。
- [四六级 cet6-20210601](decisions/cet/cet6-20210601.json)：原block[1]13—15题A/B先行，C/D位于Section C之后，需要重排才能恢复各题及栏目边界。；原block[3]Section B插入选词词库E与F之间，需重排才可恢复完整词库与下一栏目边界。；原blocks[2..3]The books we / share之间夹第3页页码，无法只空白合回句。；原blocks[3..4]another / direction之间夹第4页页码，无法只空白合回句。；原blocks[5..6]socially / defined之间夹第6页页码，无法只空白合回句。；原blocks[6..7]There is / no reason之间夹第7页页码，无法只空白合回句。；原block[7]55题D选项位于Translation标题之后，需重排才能恢复题与栏目边界。
- [四六级 cet6-20210602](decisions/cet/cet6-20210602.json)：原block[0]第1题D) Toxic位于第2题A/C之后，恢复题目选项分组需重排。；原blocks[2..3]wasn’t / as bad之间夹第26页页码，不能仅空白续句。；原blocks[3..4]the cathedral / of every之间夹第27页页码，不能仅空白续句。；原blocks[4..5]historic / monuments之间夹第28页页码，不能仅空白续句。；原blocks[5..6]these / qualities之间夹第29页页码，不能仅空白续句。；原blocks[6..7]The efforts of / millions之间夹第30页页码，不能仅空白续句。
- [四六级 cet6-20210603](decisions/cet/cet6-20210603.json)：原block[1]Section B插在词库E与F之间，完整词库及栏目边界需重排才可恢复。；原blocks[3..4]drama that / their more privileged之间夹第50页页码，不能仅空白续接。；原blocks[4..5]some of them can / define authorship之间夹第51页页码，不能仅空白续接。
- [四六级 cet6-20211202](decisions/cet/cet6-20211202.json)：原block[2]19题及其A—D选项先于Questions 19 to 21分组说明，完整分组标题边界需重排才可恢复。
- [四六级 cet6-20211203](decisions/cet/cet6-20211203.json)：原block[3]电视阅读affecting the后突接员工阅读constructively and tactfully，至block[4]员工结论；原block[5]员工阅读point out后突接电视阅读conduct of politics，两篇交叉错接，必须重排才能恢复各自连续句段。；原blocks[4..6]题目顺序51—55、49—50、Passage Two正文、46—48，阅读标题正文与题目归属交叉，非空白原序限制下无法恢复分组。
- [四六级 cet6-20220601](decisions/cet/cet6-20220601.json)：blocks[19..20] 尾部混入2022.06-02标题及未完作文Directions，现有JSON无法确定残缺内容应属本课何处；保留字符与顺序，仅分开标题及题干。
- [四六级 cet6-20220602](decisions/cet/cet6-20220602.json)：blocks[0] 在本卷标题之前含前卷54题C/D、55题及赵州桥翻译，属于跨卷残片；现有JSON无法仅调空白移除或归位，保留记录。
- [四六级 cet6-20220900](decisions/cet/cet6-20220900.json)：blocks[0..1] 听力3/4、5/6、12至15题的双栏选项跨题穿插，不能仅靠分段恢复归属顺序。；blocks[4..5] G段Washington bill/public universities及L段will/decrease，blocks[7..9] given/to privacy和sun/and sea被页码页脚隔断；不删字或重排无法恢复完整自然句，已隔离页脚并保留待确认。
- [四六级 cet6-20221201](decisions/cet/cet6-20221201.json)：blocks[1] 听力10/11及12至15题双栏选项跨题交织，未重排字符。；blocks[3..4] G段covers/international charter flights及blocks[6..7] the/longer-term consequences之间夹有乱码页脚，无法仅调整空白恢复连续句子；已单列页脚保留疑点。
- [四六级 cet6-20221202](decisions/cet/cet6-20221202.json)：blocks[0..1] 听力1至8题标签及内容错序/拆散（4题标签A/B/C/D整体先于四段文本），10至13及16/17题选项跨题交织；仅边界编辑不能恢复对应顺序。；blocks[3..4] I段is the/most important以及blocks[6..7] on the/screen之间插入乱码页脚，保留原顺序并隔离页脚，待确认。
- [四六级 cet6-20221203](decisions/cet/cet6-20221203.json)：blocks[1..3] 古典音乐F段to/show enthusiasm、O段What can/higher institutions被乱码页脚插入；blocks[4..5] 塑料段and/potentially people也被同类页脚打断。已分离页脚，不能在字符及顺序不变限制下连续合句。
- [四六级 cet6-20230300](decisions/cet/cet6-20230300.json)：blocks[0..2] 听力题组顺序及5至8题被Section B说明、编者注和页码打断，7/8题C/D在其题干之前，12至15、20/21、22至25题双栏错序；不重排保留待确认。；blocks[3..4] F段average/household income、blocks[5..6] dietary diversity,which/is not clearly被页脚隔断；现有JSON不能仅改边界恢复连续句子。
- [四六级 cet6-20230601](decisions/cet/cet6-20230601.json)：blocks[12..13] AI段like to/watch next及blocks[14..15] Phonics段low/reading scores被跨页页眉隔开；只分离页眉，保留原顺序，不能按本轮限制完整接句。
- [四六级 cet6-20230602](decisions/cet/cet6-20230602.json)：blocks[9..10] 完美主义E段focused on the/phenomenon被第5页页眉打断，已分离页眉，无法仅调空白恢复完整自然句。
- [四六级 cet6-20230603](decisions/cet/cet6-20230603.json)：blocks[5..7] G段Deep Springs/is a private与N段the need/to produce，以及blocks[7..8] 食品阅读super/delicious之间夹有页眉，已隔离页眉，完整接句需要超出空白边界权限的操作。
- [四六级 cet6-20231201](decisions/cet/cet6-20231201.json)：blocks[4..5] 农业J段improvements in/productivity之间夹有第5页页脚；blocks[6..7] 期刊首段academics and/influencing被第7页页脚截开。已分离页脚且保留原序，不能仅改空白恢复完整句。
- [四六级 cet6-20231202](decisions/cet/cet6-20231202.json)：blocks[2..3] 完形首段The/researchers与blocks[4..5] 寻宝J段coins/from a Spanish wreck被页脚阻隔。已隔离页脚，保持非空白字符原序，因此连续句仍待确认。
- [四六级 cet6-20231203](decisions/cet/cet6-20231203.json)：blocks[4..5] 蜘蛛阅读pesticide use/thought to be之间夹有23页页脚；已分离页脚但仅改空白无法恢复完整句。
- [四六级 cet6-20240601](decisions/cet/cet6-20240601.json)：原blocks[8..10]employees’ most / valuable resources之间夹block[9]第5页及URL页眉，无法只调空白恢复连续句段。
- [四六级 cet6-20240602](decisions/cet/cet6-20240602.json)：原blocks[18..20]and renewables / provided 46%之间夹block[19]第8页与URL，不能仅靠空白恢复主谓连续句。
- [四六级 cet6-20240603](decisions/cet/cet6-20240603.json)：原blocks[11..13]much more complex than we / recognise之间夹block[12]第6页与URL页眉，无法只调空白接回完整句。
- [考研 e1-1991](decisions/kaoyan-english/e1-1991.json)：原blocks[5]能源翻译中，(34)后紧接孤立残片‘ation and that, if necessity forces exports, it will be at the price of belt -tightening at home.’，缺少其前半句/段，JSON无法判断应接上一段还是另段；保留该残片独立，不猜补或重排。
- [考研 e1-2021](decisions/kaoyan-english/e1-2021.json)：原blocks[0..3]完形Section I及游离数字后置；阅读Directions从block2的Mark your到block3的answers之间被完形13—20及Section II/Part A隔断。须重排才可接续，本轮原序保留。；原blocks[3..8]四篇阅读Text标题后置，23—25夹入印尼正文；26—30及Text3夹断Victorians had fun and/could首句；33—35及Text4夹入网络中立正文。跨题边界需重排解决，本轮不移动。；原blocks[9..10]AI正文五填空位置被集中为文末(41)—(45)中文占位符；C选项advertising funds/will yield best results被整篇高教翻译正文隔断，且PartB Directions前置插入阅读36题前。无法仅改变空白恢复各题结构。；原block10高教翻译46—50五题句从对应正文抽离并集中在PartC后，正文rate of growth: / Second及within three or four years, / And if等出现缺位；其间又插有PartB选项。需恢复顺序方可接续，本轮保留独立题句。
- [考研 e1-2022](decisions/kaoyan-english/e1-2022.json)：原blocks[0..3]Section I及游离数字后置，阅读Directions的Mark your/answers被完形13—20和Section II/Part A隔断；不能靠空白接续。；原blocks[3..8]Text1—4标题均错置；22—25及Text2夹断Postgraduates more than/graduates；26—30及Text3夹断artists and/researchers；33—35及Text4夹断employers are more/cautious。恢复阅读段需重排，保留待确认。；原blocks[8..10]动物园Directions被36—40打断；五个中文占位符41—45集中在John Fraser姓名之后而非各人物边界，A—G选项与五人正文间插入密码战翻译主体。原位保留不猜空位。；原blocks[10..11]密码战46—50抽离正文，48应接History meant that的续句后置；49在intelligence/officers处被正文末段及整套51—52写作隔断；Section III/PartA/PartB后置于翻译50后。句段恢复必须重排，非本轮空白修改范围。
- [考研 e1-2023](decisions/kaoyan-english/e1-2023.json)：原blocks[0..2]完形Section I和游离编号后置；12—20题选项与Section II/PartA/Text1夹断气候Even if a state is considered a/high performer。须重排才能接回原句。；原blocks[2..5]21—25/Text2夹断短租there’s an/increased urgency首句；28—30/Text3夹在PRH正文和末段Lownie引语间；科学引用首段提前到31—35/Text4之前。各篇阅读题文顺序需重排，空白操作无法解决。；原blocks[7..8]PartB Directions插在阅读39题前；黄石F选项a fuller understanding of the/Yellowstone River region被顺序框和整篇AI翻译主体隔断，G/H选项又在译文之后。原序保留待重排。；原blocks[8..9]46—50译句全部后置于PartC，未嵌回AI正文；50的delivery of the/marketing messages被51—52写作全题隔断，SectionIII/PartA/B后置。需要非空白顺序调整，本轮不猜补。
- [考研 e1-2024](decisions/kaoyan-english/e1-2024.json)：原blocks[0..3]完形/阅读说明：Section I及空号数字在完形后，阅读说明Mark your与answers间插入13—20选项和Section II/Part A；只能原序分段，不能移回。；原blocks[4..8]阅读题页界：22—25及Text2切断养育It found that infants/had an average；33—35及Text4插入湿地正文；Text1迟在钉子全文后。需重排，保留原序。；原blocks[8..10]文物评论：Hannah的cultural/heritage被36—40和PartB/41占位符切断；42—45均在Julia后，G选项插进51邮件how to/prepare间，跨越翻译内容。；原blocks[10..11]翻译与写作：46—50集中迟置于51邮件中断处，SectionIII/PartA又在邮件续文前；按现有顺序保留各片段，不能仅空白修复上下文。
- [考研 e1-2025](decisions/kaoyan-english/e1-2025.json)：原blocks[0..3]完形阅读过渡：SectionI/数字迟置，Mark your/answers说明被13—20及SectionII/PartA切断，不能仅空白回接。；原blocks[4..8]阅读跨页：22—25及Text2插入科学奖One of/the past winners；33—35和Text4插入数字档案末段前；Text1在莎剧文后，保持原序待确认。；原blocks[8..10]蝴蝶排序与翻译说明：蝴蝶A的even more/challenging被41—45排序和翻译Directions切断，翻译Write your answers on/the ANSWER SHEET间夹全部蝴蝶选项及PartC。移位超出本轮。；原blocks[10..11]公众科学翻译：46—50从正文抽出集中在51来信后；正文They’ve与These groups前指代所需句迟置，SectionIII/PartA亦迟置。无法靠空白恢复原文章顺序。
- [考研 e1-2026](decisions/kaoyan-english/e1-2026.json)：原blocks[0..3]完形阅读说明：SectionI和空号数字迟置；Mark your/answers被13—20及SectionII/PartA隔开，需重排才能还原。；原blocks[4..8]阅读篇序：23—25及Text2在好莱坞结论前；广播第一段在26—30前，而Text3在题后；34—35及Text4在火灾全文后。原序保留明确内容段。；原blocks[8..10]阅读排序与翻译混排：阅读B的they might/pick up之间插入排序框、翻译说明、科学素养两段；科学素养1945, a/time when间插入B续文至H、PartC及46。只分开异文，无法空白回接。；原blocks[10..11]科学素养与写作：47—50集中在作文1—3要求后，SectionIII/PartA/B也在此迟置；翻译段内所需句及作文末指令被隔开，需改序待确认。
- [考研 e2-2012](decisions/kaoyan-english/e2-2012.json)：原blocks[4..5]Text4第三段：The Moral Consequences of Economic与Growth之间插入完整论坛页脚。书名及句法明确连续，但保持非空白顺序且保留页脚时无法合回完整句，续文原序单列待确认。
- [考研 e2-2014](decisions/kaoyan-english/e2-2014.json)：原blocks[2..3]Text3首段：think we are与right now之间有完整论坛页脚；明确句内续接但不得删/移页脚，只分出页脚与续文待确认。；原blocks[3..4]Text4第二段：so it is inevitable that与the attention is focused elsewhere之间插入论坛页脚；保留两侧片段，非空白顺序限制下无法接回。；原blocks[4..5]Land Art开篇：beyond the traditional与confines of the studio间有论坛页脚；需调整非正文文字位置才能恢复句子，本轮不重排。
- [考研 e2-2015](decisions/kaoyan-english/e2-2015.json)：原blocks[3..4]Text4首段：the economy is creating与jobs at a decent pace之间插入论坛页脚，句法明确连续但非空白顺序约束下不能跨页脚拼接，保留断片待确认。
- [考研 e2-2016](decisions/kaoyan-english/e2-2016.json)：原blocks[3..4]Text4 two parents working与outside the home间夹www.bjcugb.com北地论坛页脚；原blocks[5..6]超市译文the与more you’ll buy间也夹该页脚。已隔离页脚，不能不变更字符顺序接回两句。
- [考研 e2-2019](decisions/kaoyan-english/e2-2019.json)：blocks[10..11] 匹配篇their/real estate knowledge之间插入英语（二）第12页页眉，保持非空白原序无法完整接句；仅隔离页眉及续文。
- [考研 e2-2020](decisions/kaoyan-english/e2-2020.json)：blocks[0..2]完形编号缺位，3 4 5 6 8 9集中于正文后，Section I后置；无法仅靠边界恢复题序。；blocks[3..8]阅读Text1—4标题后置、下篇开头穿插前篇题目之前；PartB说明插在36—40题前；保持原字符顺序不能完整归位。；blocks[8..9]匹配题42—45占位符集中在全部正文后，不能不移动字符恢复对应位置。；block[10]Section IV及Part A/B标题在作文任务后方，保留原序待确认。
- [考研 e2-2021](decisions/kaoyan-english/e2-2021.json)：block[0]完形数字6 7 9 10 12 13集中在末尾，正文对应空号缺位，不能用边界修复。；blocks[3..8]标题后置及各篇正文与前篇题目交错；尤其block4 occupied by和block5 arable fields之间插入22—25题及Text2，不能不改原字符顺序接句。；blocks[8..9]42—45占位符集中在匹配正文之后，不能确认原对应边界。；block[10]翻译及写作章节/Part标题集中于全文末尾，无法仅靠边界归位。
- [考研 e2-2022](decisions/kaoyan-english/e2-2022.json)：blocks[0..2]完形空号脱位，阅读Directions在完形13—20题之前，Mark your与answers被题选及章节标题隔开。；blocks[3..8]标题后置/下篇正文提前，与前文试题交错；退休文they are/doing this、暗黑设计difficult/to cancel、锻炼文PhD a/faculty member等被前篇题干隔开；字符顺序限制下不能连回。；block[9]41—45占位符集中在五建议正文之后，不能仅靠分段安回。；block[10]翻译、写作章节及Part A/B标题集中篇末，保留原位置待确认。
- [考研 e2-2023](decisions/kaoyan-english/e2-2023.json)：block[0]完形8 9 13 14 15 16数字集中正文之后，无法分段复原空号位置。；blocks[3..9]阅读标题后置且下篇正文与前篇题目穿插；记忆文Half of the/participants、青少年文adolescence/and then、建筑规则energy efficiency and/heating等续句之间夹前篇题目，不改变字符顺序不能归位。；blocks[10..11]Section III/IV及PartA/B晚于译文和小作文，章节错位待确认；匹配题姓名和选项原本按表格左右交错，仅隔离不排序。
- [考研 e2-2024](decisions/kaoyan-english/e2-2024.json)：blocks[0..3]：Section I标题及孤立数字3 4 5 6 18 19出现在完形正文之后；阅读说明Mark your与answers之间插入完形13-20及Section II/Part A，不能只改空白恢复连续说明。；blocks[3..8]：Text 1标签在正文后；木材阅读开头插入21与22-25之间，Text 2标签在开头正文后；老年驾驶开头在26-30前，Text 3后才续正文；健康应用正文插入33与34-35之间，Text 4标签后置。需要重排，不擅改。；blocks[8..10]：课外活动匹配说明及开头先于健康应用36-40题，随后Part B标签和匹配续文；41-45人名与A-G选项交织。已分离独立项目，完整连续阅读顺序仍需确认。；blocks[10..11]：Section III Translation/Section IV Writing/Part A在47题后才出现，Part B在48题后。标题归属顺序需重排，不能空白修复。
- [考研 e2-2025](decisions/kaoyan-english/e2-2025.json)：block0完形后置Section I和孤立数字1 2 4 5 8 9 12 13；block3阅读后置Section II/Part A/Text 1。保持现有次序，不能空白修复标题归属。；blocks4..8：NHS正文插入21与22-25题之间，Text 2标签后置；印度高温计划开头出现在26-30前而续文在Text 3后；愿望路径正文插入33与34-35题之间，Text 4后置；职场匹配说明开头先于36-40题而Part B后置。各文章和题组需要重排。；block9五个(41)..(45)中文占位符集中在五段职场文章之后，不能仅凭空白归回对应空位；已逐项分开保留，需确认正确题干布局。；block10：Section IV Writing/Part A/Part B全部位于47、48题后，不能空白恢复正确标题位置。
- [考研 e2-2026](decisions/kaoyan-english/e2-2026.json)：block0完形正文后出现Section I及孤立数字5 6 8 9 12 13 18 19；block3阅读正文后出现Section II/Part A/Text 1。保留次序，标题归属需重排确认。；blocks4..6：AI正文插入21与22-25题之间，Text 2后置；铁路开头出现在26-30前，block5末句tourism与block6首行accounts for 10 percent of GDP.被26-30题和Text 3隔开。不能仅改空白恢复连续句段。；blocks7..9：芝加哥节庆正文插入33与34-35题之间且Text 4后置；森林修复开头先于36-40题，block8结尾and与block9开头nurseries to raise seedlings被36-40题及Part B隔开。需要重排题组与文章。；blocks9..10匹配题41-45人物与A-G选项交错排列；已分离各项保留顺序，题组布局仍需确认。；block10的Section III Translation/Section IV Writing/Part A/Part B插入48题should与block11两条写作要求之间，标题位置需要重排确认。

全部实时状态见 [ledger.tsv](ledger.tsv)，剩余路径见 [summary.json](summary.json)。过期阶段快照已清理，可从 Git 提交 `4a51efb9` 找回。
