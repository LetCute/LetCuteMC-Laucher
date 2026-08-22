export interface NameMCSkin {
  id: string
  name: string
  category: 'hot_vn' | 'anime' | 'boy' | 'girl' | 'meme'
  url: string
  model: 'default' | 'slim'
  author?: string
}

export interface NameMCCategory {
  key: 'all' | 'hot_vn' | 'anime' | 'boy' | 'girl' | 'meme'
  label: string
}

export const NAMEMC_CATEGORIES: NameMCCategory[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'hot_vn', label: 'Hot VN & Creator' },
  { key: 'anime', label: 'Anime & Game' },
  { key: 'boy', label: 'Boy ngầu' },
  { key: 'girl', label: 'Cute & Nữ' },
  { key: 'meme', label: 'Meme & Độc lạ' },
]

export const NAMEMC_CURATED_SKINS: NameMCSkin[] = [
  {
    "id": "slenderman",
    "name": "SlenderMan",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/85968b6160f380fbe7869a3070eb7fb76267db07d684ec20f7e98c1d073dd702",
    "model": "slim",
    "author": "Slenderman"
  },
  {
    "id": "mixigaming",
    "name": "Độ Mixi",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/49f83fe3d7ffe1962666d6fc8d1e9c7207945c7f628fbfc2a2dd69ff74fe9f3c",
    "model": "default",
    "author": "MixiGaming"
  },
  {
    "id": "channy",
    "name": "Channy",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/fc10ca7331f5684338bd5c88d463aa3b811eeb955dd00d4fe4ad823c2c5acf44",
    "model": "default",
    "author": "Channy"
  },
  {
    "id": "meosimmy",
    "name": "Mèo Simmy",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/fca20ced03f32a96e1ad3bc0a8056cf3e0a90b0827152b5f1c88c6c211c0ec0e",
    "model": "default",
    "author": "MeoSimmy"
  },
  {
    "id": "siro",
    "name": "Siro",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/d9e0ced0f0fe7836138a46778d6e50ab3820fb4561c869682df5ca2b65292ab6",
    "model": "default",
    "author": "Siro"
  },
  {
    "id": "kresh",
    "name": "Kresh",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/183fd21f798f7e1107d026e6c093b6f2681cf74acdf70b6dc04973ffdfd99b53",
    "model": "default",
    "author": "Kresh"
  },
  {
    "id": "conga",
    "name": "Con Gà",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/e1aca2c4849924944d4c18559b90f34b256ae9e8bc82cf519b79be280250da26",
    "model": "slim",
    "author": "Conga"
  },
  {
    "id": "sangtraan",
    "name": "Sang Trần",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/86892f68777e82be19d17b32411f40a4858102bfd5607d5d1caacae0684cc619",
    "model": "default",
    "author": "sangtraan"
  },
  {
    "id": "sammy",
    "name": "Sammy Đào",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/b90b77c964e5a2deaceccc5075981743a082ee79b02d439697684b51408b2d40",
    "model": "slim",
    "author": "Sammy"
  },
  {
    "id": "dream",
    "name": "Dream",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/ca93f6fc40488f1877cda94a830b54e9f6f54ab58a5453bad5c947726dd1f473",
    "model": "slim",
    "author": "Dream"
  },
  {
    "id": "technoblade",
    "name": "Technoblade",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/8c907a7f4f0c3a6c9c9b79348f7bf1993695b6d2eae2fab704a1a4d9b8288cbe",
    "model": "default",
    "author": "Technoblade"
  },
  {
    "id": "notch",
    "name": "Notch (Creator)",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680",
    "model": "default",
    "author": "Notch"
  },
  {
    "id": "herobrine",
    "name": "Herobrine",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/5d58ac578d8d46b09c61e6508cd91a427606824344234e8e8eb082cac28b5b40",
    "model": "default",
    "author": "Herobrine"
  },
  {
    "id": "gigachad",
    "name": "GigaChad",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/69e4d084bb78c13e868b41eb561c77a34a55eda44c1aeb628bc2477d98011ce6",
    "model": "default",
    "author": "GigaChad"
  },
  {
    "id": "hacker",
    "name": "Hacker Pro",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/a1b80b11ae1f93be090558400a3c29fea1f3e9e8603f9a1927ba79f260cf9f05",
    "model": "default",
    "author": "Hacker"
  },
  {
    "id": "gumball",
    "name": "Oops Gumball",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/630ed01ab1351ba502d60b53fb52bf5152fc7fe7c4b3f44a330469bd6e76d048",
    "model": "default",
    "author": "Gumball"
  },
  {
    "id": "vindaddy",
    "name": "Vindaddy",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/28e4ee32b47fc7b007f8891af7eecdd37cc9ccf9d5b26312b7344cb62a6f0938",
    "model": "default",
    "author": "VINDADDY"
  },
  {
    "id": "redhoodvn",
    "name": "RedhoodVN",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/5ecdf038049e5b3075a2d5c9dcc98adfe7aae789a251f7327a2e304af4d5ba87",
    "model": "default",
    "author": "RedhoodVN"
  },
  {
    "id": "mistervit",
    "name": "Mister Vịt",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/24ac572232db1a6581e566de35f248bb05d29d2286fd3e22ac83b57743af4096",
    "model": "slim",
    "author": "MisterVit"
  },
  {
    "id": "kamui",
    "name": "Kamui",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/805db6996b652f02e86c87ded8b1cc583b927ff1ad8a4f011ff79c8687a659e1",
    "model": "default",
    "author": "Kamui"
  },
  {
    "id": "thienmc",
    "name": "Thiện MC",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/c481ba5ed8e4d6b38750e9955557f0d66cc7173a86de3e87cbf26c4ccb02d7bc",
    "model": "default",
    "author": "ThienMc"
  },
  {
    "id": "vuliz",
    "name": "Vũ Liz",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/74ed728ecd74b2a2013d6c000ad02a6ae0f18315acf1bbcc7a5fb98821bfe357",
    "model": "default",
    "author": "Vuliz"
  },
  {
    "id": "sheep",
    "name": "Sheep Minecraft",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/24a0f9ef0028cdc930cb37584ac10ddd498222559a792b64d71f746f69eb1a4b",
    "model": "slim",
    "author": "Sheep"
  },
  {
    "id": "tuxedo",
    "name": "Tuxedo Gamer",
    "category": "hot_vn",
    "url": "https://textures.minecraft.net/texture/c0040c0e283390054cf8008d98886cd6d86dc41884bcca969a5dae6170922a5a",
    "model": "default",
    "author": "Tuxedo"
  },
  {
    "id": "goku",
    "name": "Son Goku",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/b43f45dba4e09732d42eaf34a7f53a69182281fd26f7850c4383a59ea6e875f5",
    "model": "default",
    "author": "Goku"
  },
  {
    "id": "naruto",
    "name": "Naruto Uzumaki",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/39441d14cd6f9fd3017df5025a62027b51375e364e4c496056cac416d6bbe0d5",
    "model": "default",
    "author": "Naruto"
  },
  {
    "id": "luffy",
    "name": "Monkey D. Luffy",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/43c9af51fe4e9a373f99a35d9b03e2e98cd9056fa6bfaa92e15c81a61ff32b98",
    "model": "default",
    "author": "Luffy"
  },
  {
    "id": "tanjiro",
    "name": "Kamado Tanjiro",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/2c7f5c019d62f1515b0ecc53a63acbc725199bdc4de93338a224249ffc0fc224",
    "model": "slim",
    "author": "Tanjiro"
  },
  {
    "id": "nezuko",
    "name": "Kamado Nezuko",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/721fd5b6df6b1e460cc8673dcb86434e9b8e35a7d444e3b1f67ab19053bd2c12",
    "model": "default",
    "author": "nezuko"
  },
  {
    "id": "gojo",
    "name": "Gojo Satoru",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/41754d71350fb3624c3fd3d8ee68c29efc11cb9eccc996be07422154602c2e4c",
    "model": "default",
    "author": "Gojo"
  },
  {
    "id": "sukuna",
    "name": "Ryomen Sukuna",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/67755b529939475bff9994fd529504b3e144974fbfddb7cb10a7dc0659b07d27",
    "model": "default",
    "author": "Sukuna"
  },
  {
    "id": "zoro",
    "name": "Roronoa Zoro",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/5dc8add1961ebd5949c844227fb7175af6d0f207dfcee68de9fc15c716a3bbe2",
    "model": "slim",
    "author": "Zoro"
  },
  {
    "id": "levi",
    "name": "Levi Ackerman",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/ec112df892858de73a63e4e66308e60668e5f6f7e8eafd164f590d9f4e1f9b20",
    "model": "default",
    "author": "Levi"
  },
  {
    "id": "hutao",
    "name": "Hu Tao (Genshin)",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/d5c4ee5ce20aed9e33e866c66caa37178606234b3721084bf01d13320fb2eb3f",
    "model": "slim",
    "author": "HUTAO"
  },
  {
    "id": "raiden",
    "name": "Raiden Shogun",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/a3489da2e4cf33ecc2143b14fbe01b9a9a99af6f36588e67df3e8eb80f97ff2e",
    "model": "default",
    "author": "Raiden"
  },
  {
    "id": "furina",
    "name": "Furina (Genshin)",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/46acd06e8483b176e8ea39fc12fe105eb3a2a4970f5100057e9d84d4b60bdfa7",
    "model": "slim",
    "author": "Furina"
  },
  {
    "id": "saitama",
    "name": "Saitama (One Punch)",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/4aeb083fd5c7b70244a30b7922b22aeadf24a4b60028f3341d7b5321d5e59b84",
    "model": "default",
    "author": "Saitama"
  },
  {
    "id": "sasuke",
    "name": "Uchiha Sasuke",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/9fe18967870a4670c5b4d808aa1e76dc155fbe70a76981480ce27e3bd4c34b51",
    "model": "slim",
    "author": "Sasuke"
  },
  {
    "id": "kakashi",
    "name": "Hatake Kakashi",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/89ec47c7cd326c33616d9254406d9b916c4895c1b4b29e4c9503963044906b47",
    "model": "default",
    "author": "kakashi"
  },
  {
    "id": "deku",
    "name": "Midoriya Izuku (Deku)",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/93a3fb4588cca40f27274e648fcea764e8c5aa364ec4f87142bbb56cc6aa5418",
    "model": "slim",
    "author": "Deku"
  },
  {
    "id": "bakugo",
    "name": "Bakugo Katsuki",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/322038cb55c3f7688df2047fe79dcb1aed8d4a556174fc54abd66004c63716ef",
    "model": "default",
    "author": "Bakugo"
  },
  {
    "id": "eren",
    "name": "Eren Yeager",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/7eeed50b32fc48aee3dbd07f61d662bff482ab0aa97c78cc3110b62bce59a2e9",
    "model": "default",
    "author": "Eren"
  },
  {
    "id": "mikasa",
    "name": "Mikasa Ackerman",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/5f95cd9d62183ee072140bdb3ad7c46ebd3bdb063070000685a5c4780a6dfe9b",
    "model": "slim",
    "author": "Mikasa"
  },
  {
    "id": "denji",
    "name": "Denji (Chainsaw Man)",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/1b63ffc70cc614800e61027c4e172536e85783500d21ba8e74b6efc4ef1ff403",
    "model": "slim",
    "author": "Denji"
  },
  {
    "id": "makima",
    "name": "Makima",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/5f675340c8d7d82573e7ded518109bbfe4bf1de1e32a5dd91d3f139bf5d9207a",
    "model": "slim",
    "author": "Makima"
  },
  {
    "id": "anya",
    "name": "Anya Forger",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/7f5d6478d2e91041e4fff6dc71cc4c51377d4acf92aa85904fe3dc55d7f47e17",
    "model": "default",
    "author": "anya"
  },
  {
    "id": "mario",
    "name": "Super Mario",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/3f09df4e9ea64ca36b16d41bffeeb20f8d5c429b060d809aa41a64f37d5cf058",
    "model": "default",
    "author": "Mario"
  },
  {
    "id": "sonic",
    "name": "Sonic Hedgehog",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/2c56f70437d3ccd406af69f813d0cd7fd4b476f228b8f4aa6c974b691530fe9a",
    "model": "default",
    "author": "Sonic"
  },
  {
    "id": "sans",
    "name": "Sans (Undertale)",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/fece7017b1bb13926d1158864b283b8b930271f80a90482f174cca6a17e88236",
    "model": "default",
    "author": "sans"
  },
  {
    "id": "killua",
    "name": "Killua Zoldyck",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/efe8831e1cfa7030424c737259fe112f99074ad8521bc882e1ae215b4364babc",
    "model": "default",
    "author": "Killua"
  },
  {
    "id": "zenitsu",
    "name": "Agatsuma Zenitsu",
    "category": "anime",
    "url": "https://textures.minecraft.net/texture/3647128dca4c029a3a1a75c3be2841f343eae75eb707bacd4ffccd69cbe923d4",
    "model": "default",
    "author": "Zenitsu"
  },
  {
    "id": "shadow",
    "name": "Shadow Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/af9c9b9c99f0a3e1c23ab9f93a7581d2ad261da359a8d4e7f9defc344ff315d3",
    "model": "default",
    "author": "Shadow"
  },
  {
    "id": "ninja",
    "name": "Cyber Ninja",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b",
    "model": "default",
    "author": "Ninja"
  },
  {
    "id": "samurai",
    "name": "Dark Samurai",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/56c11f19f116fbbba06c0fa26de1a9b340d11a7e01f5beb52b50ff6936e460c8",
    "model": "default",
    "author": "Samurai"
  },
  {
    "id": "demon",
    "name": "Demon Horns",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/143a31312800c59beb81451c383ed4585bbcc6326156ee92d6b385760d3dbee7",
    "model": "default",
    "author": "demon"
  },
  {
    "id": "knight",
    "name": "Paladin Knight",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/a2e2dc109d22b610043a25567ab96c5179a6338461b40725f06874dcabb145b",
    "model": "default",
    "author": "Knight"
  },
  {
    "id": "gamer",
    "name": "Pro Gamer",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/63b85112e13ec4f82ce901354ecd0951b65f8bcc29cf318a030da618a99b9704",
    "model": "default",
    "author": "Gamer"
  },
  {
    "id": "cyberpunk",
    "name": "Cyberpunk Red",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/1c70af6b8b22bacd1350c522611f002353fd61692fdcae0555d5c493cdf839b9",
    "model": "default",
    "author": "Cyberpunk"
  },
  {
    "id": "hoodie",
    "name": "Black Hoodie Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/c6bb5ec033de1c6a384e1f1b996fc59a5a79a8e098864319fe0b747271bb2f81",
    "model": "default",
    "author": "hoodie"
  },
  {
    "id": "phantom",
    "name": "Phantom Assassin",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/916014734bd73041e440803634e1f6c10d5d12701dbe2106bd4a3283369ac08f",
    "model": "default",
    "author": "Phantom"
  },
  {
    "id": "assassin",
    "name": "Elite Assassin",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/38735c0e3b7780731e9a82ce44fdc606e502539a78be58585d4993ebaeba49cf",
    "model": "default",
    "author": "Assassin"
  },
  {
    "id": "vampire",
    "name": "Vampire Lord",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/fabe5ab0e89fb6f9d92067a692829ba9f6a69b095c533e5933f3dd7137b188f0",
    "model": "default",
    "author": "Vampire"
  },
  {
    "id": "reaper",
    "name": "Grim Reaper",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/37bc025564500d20f5af827a6381240d9e6cf075ac3cd10b57f9d58e6a7060f5",
    "model": "default",
    "author": "Reaper"
  },
  {
    "id": "darkangel",
    "name": "Dark Angel Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/97c7bdfabe7e42dc789f6019b684142af5cd4c1382b7b52fea882643ff06f4b5",
    "model": "default",
    "author": "DarkAngel"
  },
  {
    "id": "fireboy",
    "name": "Fire Elemental Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/35d0aace31b80a122581c3d33cc84cb9219a3e96184836f9a9aa87930f69f7fc",
    "model": "default",
    "author": "fireboy"
  },
  {
    "id": "iceboy",
    "name": "Ice Frost Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/41748182360381836bb17d4d1c717643f6e5c5791c7ce00b235ce0204a0dfaab",
    "model": "slim",
    "author": "iceboy"
  },
  {
    "id": "ghost",
    "name": "Ghost Soul",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/25658d39a05f5407a2e7c0ab88fc50031da73ab3f651850d21e491af6659ad60",
    "model": "default",
    "author": "Ghost"
  },
  {
    "id": "wolf",
    "name": "Lone Wolf Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/15b6f1b8dad23c1605490f2402db70f22a2d8e76dc29bd27a0c93ca089e9d99a",
    "model": "default",
    "author": "Wolf"
  },
  {
    "id": "dragon",
    "name": "Dragon Knight",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/c01a7b90891caf2950bbbb09e4e0d915a503eac985a5078ca583fddf0326be37",
    "model": "default",
    "author": "Dragon"
  },
  {
    "id": "streetwear",
    "name": "Streetwear Cool",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/a75c9958e4afbc17ac2e498300080098f635ca875afebbfd5650a799235bc802",
    "model": "default",
    "author": "Streetwear"
  },
  {
    "id": "matrix",
    "name": "Matrix Hacker",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/72e22e3dee59116b914db850fa1094d28e781821cb7758837c2db9cab099008a",
    "model": "default",
    "author": "Matrix"
  },
  {
    "id": "cyber",
    "name": "Cyber Neon Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/d269e71d7f59d1039feb838c6eda05bc00f5fd167311439dd024280c28cfece3",
    "model": "default",
    "author": "Cyber"
  },
  {
    "id": "toxic",
    "name": "Toxic Biohazard",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/f55287bb4af35fa8d7cd74eb04d5f42bbaca60a25ee6ef71397525afe1adeb9b",
    "model": "slim",
    "author": "Toxic"
  },
  {
    "id": "neon",
    "name": "Neon Blue Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/9828953698b2ea2038621a0416b3b1c113dca22e76aceedf8d0d539d13000534",
    "model": "default",
    "author": "Neon"
  },
  {
    "id": "king",
    "name": "Crown King",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/3df694405bec1d1bd2948dbc8c801c435bc8b6bfead975a19c56c7364ad7cc2d",
    "model": "default",
    "author": "King"
  },
  {
    "id": "galaxy",
    "name": "Galaxy Cosmic Boy",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/b99abf8ceb8608c9f31c790b57d611d2506f95fc28305be70af24a4a84c7d66b",
    "model": "default",
    "author": "Galaxy"
  },
  {
    "id": "void",
    "name": "Void Shadow",
    "category": "boy",
    "url": "https://textures.minecraft.net/texture/417996c0cdff3419e22f81a919d98ac2f8b3acc9e3eb309d177e07cb50600e1f",
    "model": "slim",
    "author": "Void"
  },
  {
    "id": "cute",
    "name": "Pastel Bunny Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/9b3de93991b875de59300d44308183134af40f24c930f50d241308c5c3d93320",
    "model": "slim",
    "author": "cute"
  },
  {
    "id": "angel",
    "name": "White Angel Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/81f2fb3ad1988ce65bbec45068138f08bb8e3f4116b6a3f288bdeeee881fc43",
    "model": "default",
    "author": "Angel"
  },
  {
    "id": "sakura",
    "name": "Sakura Blossom Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/77ba759fede48b0afca5955de456eac8a7cad823f8ed0d53ab208153b1afd306",
    "model": "default",
    "author": "Sakura"
  },
  {
    "id": "strawberry",
    "name": "Strawberry Soft",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/33c56c4838b5b33803b419e32b60422eef99c1a4d5ba132777f10b566996352",
    "model": "slim",
    "author": "Strawberry"
  },
  {
    "id": "bunny",
    "name": "Cute Bunny Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/a1974863c99b3c2d3227cad28545ae8f272a761ccb388f9f6c3ef895688460f",
    "model": "default",
    "author": "Bunny"
  },
  {
    "id": "kitten",
    "name": "Cat Girl Hoodie",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/4e1ac1403c62bc9e8581001d723b136e487191ae5e68947a24c5139a73ee041b",
    "model": "slim",
    "author": "kitten"
  },
  {
    "id": "princess",
    "name": "Pink Princess",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/7637ab4c429ecbe412f22106838b528051885ab5f3382721a253e62e8da2ce07",
    "model": "default",
    "author": "Princess"
  },
  {
    "id": "fairy",
    "name": "Forest Fairy",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/347a3e02bd1dcf9142659338b3ffc2beadf55ba40b13d9ccaac7332b80caff00",
    "model": "default",
    "author": "fairy"
  },
  {
    "id": "butterfly",
    "name": "Butterfly Dream",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/7308b636d5780f9b06fdcef9ead8602e70a11da546d5c3e9e1e0f52b7c344d04",
    "model": "default",
    "author": "Butterfly"
  },
  {
    "id": "pastel",
    "name": "Pastel Aesthetic Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/3d3a6f960b987b1b7bf445905b9e15c943f8a79cf7515d9b4a938b125718e497",
    "model": "slim",
    "author": "Pastel"
  },
  {
    "id": "blossom",
    "name": "Cherry Blossom Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/3d1f87613bb4d7e2fa70d75e6b72bf3b41580fdbdc74809b215e43b1754d242c",
    "model": "slim",
    "author": "Blossom"
  },
  {
    "id": "star",
    "name": "Starry Night Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/a1ea6af1ae3db82f8cd92ee9f388853dff41a76cf831b13b6bc711ede82bb03e",
    "model": "slim",
    "author": "Star"
  },
  {
    "id": "moon",
    "name": "Moonlight Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b",
    "model": "default",
    "author": "Moon"
  },
  {
    "id": "honey",
    "name": "Honey Bear Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/a866d3c2a9aeac8585e6cdbe02e1c523ca64dfd7cb39a3c03c48d4c06bb2eeb0",
    "model": "slim",
    "author": "Honey"
  },
  {
    "id": "peach",
    "name": "Peach Sweet Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/58e313026cd8b9053d9f909c68c1116eef9a8dd1e9ecd5b5922c691f9da2e929",
    "model": "default",
    "author": "Peach"
  },
  {
    "id": "sweet",
    "name": "Sweetie Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/10b50611a5a22b275e1ae87757f9f2747d91c9b7d83c58087188f158a1156538",
    "model": "default",
    "author": "Sweet"
  },
  {
    "id": "cookie",
    "name": "Cookie Bear Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/90ade03dc354d7a1aa7dbfe3adda041c863822cc94886880f2098a678098513c",
    "model": "slim",
    "author": "Cookie"
  },
  {
    "id": "panda",
    "name": "Panda Hoodie Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/886b1a07f7ec29b344836121bbdf86147b7a7f76bc15e6d9581722bf46efb473",
    "model": "default",
    "author": "Panda"
  },
  {
    "id": "rose",
    "name": "Red Rose Maiden",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/1f7dfc52e90d65ffeb0f5083b17f43a5c3195273b1b149bb65975b6a147b067a",
    "model": "default",
    "author": "Rose"
  },
  {
    "id": "daisy",
    "name": "Daisy Flower Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/d0de46d4f89518161156e2cbc2f69cb08e141b69e781b95c7afce6f0b9537c1e",
    "model": "default",
    "author": "daisy"
  },
  {
    "id": "maid",
    "name": "Cat Maid Dress",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/bcf1511660a24343379bd98edb62e3ed49ca63a7855f57d47cbfb0fc68406899",
    "model": "default",
    "author": "Maid"
  },
  {
    "id": "sailor",
    "name": "Sailor Uniform Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/ba11c48c84dfdccb1939cf6ffac5cce3188318fd5c6d2c75920c6bba886c58c9",
    "model": "default",
    "author": "Sailor"
  },
  {
    "id": "soft",
    "name": "Soft Kawaii Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/af815c17fad86a32e7fbab07e9f26a8eec864b398edf739e2301899e8b504ed7",
    "model": "default",
    "author": "Soft"
  },
  {
    "id": "kawaii",
    "name": "Kawaii Neko Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/d80ad2abe9ebba171d31e5dd4b7f20d9f16d753f43a3fbeda03590f0fa4d5041",
    "model": "default",
    "author": "Kawaii"
  },
  {
    "id": "lily",
    "name": "Water Lily Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/a5577064b9ef23fe778db7fed13bfbbb6c3787b03262b2c475774f3c67fe7725",
    "model": "default",
    "author": "Lily"
  },
  {
    "id": "ruby",
    "name": "Ruby Crimson Girl",
    "category": "girl",
    "url": "https://textures.minecraft.net/texture/8f176fadad77052c607a32a401c8f7ff58dee06c0a94119e7455ec6385262467",
    "model": "default",
    "author": "Ruby"
  },
  {
    "id": "shrek",
    "name": "Shrek The Ogre",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/cceda2e41ce600ca53e73a6fee20da46fb2caa139ccaec5a757f3dcbb57b94e6",
    "model": "default",
    "author": "Shrek"
  },
  {
    "id": "capybara",
    "name": "Capybara Chill",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/a15b384c9b81eadaf16669fe35832704cc058c8a3a8be001364b199604be7e6a",
    "model": "default",
    "author": "Capybara"
  },
  {
    "id": "doge",
    "name": "Doge Meme Dog",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/582b2ab048b67ed4ef93136965c1af85fb051600956ba55c200599331da49ecb",
    "model": "default",
    "author": "DOGE"
  },
  {
    "id": "pepe",
    "name": "Pepe The Frog",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/8d921e0fb1adf121e0136366069756dd1ad8db361c7cc818468e9683f6e84604",
    "model": "default",
    "author": "Pepe"
  },
  {
    "id": "kermit",
    "name": "Kermit In Suit",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/7cb3ba52ddd5cc82c0b050c3f920f87da36add80165846f479079663805433db",
    "model": "default",
    "author": "kermit"
  },
  {
    "id": "bread",
    "name": "Bread Head Man",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/dd62837543f83a0faa1e2e986a794fe75646b3bcc9a9f1beaaa24b77ed44a959",
    "model": "default",
    "author": "bread"
  },
  {
    "id": "thanos",
    "name": "Thanos Infinity",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/df1fb7d342513c92ece54bfd016f10e1ad8874ecf3c8d47a11c7aac33895cbef",
    "model": "default",
    "author": "Thanos"
  },
  {
    "id": "walter",
    "name": "Walter White (Heisenberg)",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/bb3a1618018a528681afff0e94e578a61afb2495d4f2613f62fbc14ddc669ac9",
    "model": "default",
    "author": "Walter"
  },
  {
    "id": "saul",
    "name": "Saul Goodman (Lawyer)",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/9047c17a8ec1ed0448287d0e2bd8c20f3f4681ce9d2d8448248c8295bc06ff0b",
    "model": "default",
    "author": "Saul"
  },
  {
    "id": "minion",
    "name": "Minion Banana",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/b660acedb23eafea1ef4f1d918c13ae2da03878a77f22010bb962757a4d084ee",
    "model": "default",
    "author": "Minion"
  },
  {
    "id": "patrick",
    "name": "Patrick Star",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/6ac6ca262d67bcfb3dbc924ba8215a18195497c780058a5749de674217721892",
    "model": "slim",
    "author": "Patrick"
  },
  {
    "id": "spongebob",
    "name": "SpongeBob SquarePants",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/c12d7952c2b80e0f635553217028bdb1980be5c847eb91148245d65dc6acfaa0",
    "model": "slim",
    "author": "Spongebob"
  },
  {
    "id": "batman",
    "name": "The Batman",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/c804e1fd620f4c7c9ff36e0810bf77b79662d75759f90ae992336682b1788ab0",
    "model": "default",
    "author": "Batman"
  },
  {
    "id": "spiderman",
    "name": "Spider-Man",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/65a7704b73212946f48f21dfdd6fca68e3c680e9283949850d4dacf12a1ec98f",
    "model": "slim",
    "author": "SpiderMan"
  },
  {
    "id": "ironman",
    "name": "Iron Man Armor",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/7cb05fc0ee938f49eab166c393e607a4f5f8b7061bc1e5cdca965eb95146dc75",
    "model": "default",
    "author": "IronMan"
  },
  {
    "id": "joker",
    "name": "The Joker",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/a274f62dfe9ae62a4534fb1676c68ff46e1c989a2f9249d8f5f7af988cc8fe99",
    "model": "slim",
    "author": "joker"
  },
  {
    "id": "potato",
    "name": "Potato Couch Man",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/1fa64cec861858dad00034261c7a2b3ad94cd5082b0128f012dc34b589308321",
    "model": "default",
    "author": "potato"
  },
  {
    "id": "banana",
    "name": "Dancing Banana",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/275529ea878ab47890ee25767db3ca71daa9867cb8802ab9742d36b30cde620d",
    "model": "default",
    "author": "Banana"
  },
  {
    "id": "noob",
    "name": "Classic Noob",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/d5c4ee5ce20aed9e33e866c66caa37178606234b3721084bf01d13320fb2eb3f",
    "model": "slim",
    "author": "noob"
  },
  {
    "id": "bacon",
    "name": "Bacon Hair Man",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/f5eab274eed52addac429ceaebed60acf42845534d9bb52e8e28c4ff02b90ad3",
    "model": "default",
    "author": "Bacon"
  },
  {
    "id": "dab",
    "name": "Dabbing Dude",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/786c40deb45f86d42145fd5e18cad34bd88c7135b409bced88995571c14c65c5",
    "model": "slim",
    "author": "dab"
  },
  {
    "id": "trash",
    "name": "Trash Can Meme",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/54dd669315cf5ed6161dd14036b955ea70e266984c299c5f4684e9a7cd5825e1",
    "model": "default",
    "author": "Trash"
  },
  {
    "id": "skeleton",
    "name": "Skeleton In Suit",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/bf0f5230327eeffb7631f37be548ad7bdb32ca743c06791dcb7743bb96166991",
    "model": "default",
    "author": "Skeleton"
  },
  {
    "id": "creeper",
    "name": "Creeper In Hoodie",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/3e8e0c40b0e931c77c264eb0a050d7e6ebbe5abf3ea92ae147548e5d3ec7bd82",
    "model": "default",
    "author": "Creeper"
  },
  {
    "id": "zombie",
    "name": "Business Zombie",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/783aaaee22868cafdaa1f6f4a0e56b0fdb64cd0aeaabd6e83818c312ebe66437",
    "model": "default",
    "author": "Zombie"
  },
  {
    "id": "rick",
    "name": "Rick Astley (Never Give Up)",
    "category": "meme",
    "url": "https://textures.minecraft.net/texture/6d37966b6846bdcc6b2b42c0bc771c9e06016aad5447018d448c3bdfd68908e3",
    "model": "default",
    "author": "Rick"
  }
]
