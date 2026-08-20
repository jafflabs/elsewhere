/*
  Elsewhere configuration
  -----------------------
  The Supabase publishable/anon key is designed to be used in browser apps.
  Security comes from Row Level Security policies in supabase/schema.sql.
  NEVER place a service-role key in this file.
*/

window.ELSEWHERE_CONFIG = {
  appName: "Elsewhere",
  tagline: "We get to choose.",

  supabase: {
    url: "https://gwxnopwwoyenuzpyvfdh.supabase.co",
    publishableKey: "sb_publishable_qnaJgCMmTOgBIdM20ODJSQ_PjV9d-pq"
  },

  reactions: [
    { key: "yeah_nah", label: "Yeah, nah", short: "Pass", tone: "no" },
    { key: "nah_yeah", label: "Nah, yeah", short: "Yes", tone: "yes" },
    { key: "yeah_nah_yeah", label: "Yeah, nah, yeah", short: "Growing on me", tone: "maybe" },
    { key: "love", label: "♥", short: "Love", tone: "love" },
    { key: "hmm", label: "Hmm", short: "Research", tone: "research" }
  ],

  regions: [
    { key: "new-england", name: "New England", state: "Regional", searchPlace: "New England", note: "Broad regional sweep before narrowing." },
    { key: "southern-maine", name: "Southern Maine / Portland", state: "ME", searchPlace: "Portland Maine", note: "Portland employment access with rural possibilities outside the city." },
    { key: "midcoast-maine", name: "Midcoast Maine", state: "ME", searchPlace: "Midcoast Maine", note: "Smaller communities, coast, nature, and a different employment rhythm." },
    { key: "bangor-maine", name: "Bangor / Central Maine", state: "ME", searchPlace: "Bangor Maine", note: "Lower-density Maine with regional healthcare and university anchors." },
    { key: "burlington-vermont", name: "Burlington / Champlain Valley", state: "VT", searchPlace: "Burlington Vermont", note: "Vermont's strongest employment cluster with quick access to rural living." },
    { key: "southern-vermont", name: "Southern Vermont", state: "VT", searchPlace: "Brattleboro Vermont", note: "Brattleboro / Bennington / nearby western Massachusetts connections." },
    { key: "southern-nh", name: "Southern New Hampshire", state: "NH", searchPlace: "Nashua New Hampshire", note: "Boston-accessible employment with more room outside the metro core." },
    { key: "seacoast-nh", name: "New Hampshire Seacoast", state: "NH", searchPlace: "Portsmouth New Hampshire", note: "Portsmouth / Exeter / Dover corridor." },
    { key: "greater-boston", name: "Greater Boston Exurbs", state: "MA", searchPlace: "Boston Massachusetts", note: "High opportunity density; test whether exurban living makes the tradeoffs work." },
    { key: "pioneer-valley", name: "Pioneer Valley / Western Massachusetts", state: "MA", searchPlace: "Northampton Massachusetts", note: "College towns, culture, rural access, and I-91 corridor." },
    { key: "central-ma", name: "Central Massachusetts", state: "MA", searchPlace: "Worcester Massachusetts", note: "Worcester employment access with more rural options west and north." },
    { key: "central-ct", name: "Central Connecticut", state: "CT", searchPlace: "Hartford Connecticut", note: "Hartford / Berlin / New Haven access with smaller-town options around them." },
    { key: "capital-region-ny", name: "Capital Region / Hudson Valley", state: "NY", searchPlace: "Albany New York", note: "Albany / Troy / Hudson Valley possibilities." },
    { key: "central-ny", name: "Central New York / Syracuse", state: "NY", searchPlace: "Syracuse New York", note: "Strong affordability and regional employment anchors." },
    { key: "finger-lakes", name: "Finger Lakes / Rochester", state: "NY", searchPlace: "Rochester New York", note: "Technology, universities, healthcare, and access to rural areas." },
    { key: "scotland", name: "Scotland / UK — long shot", state: "UK", searchPlace: "Scotland United Kingdom", note: "Explore only where sponsorship and work authorization are genuinely realistic." }
  ],
searchLenses: {
  Brad: [
    {
      key: "architecture-integration",
      name: "Architecture & Integration",
      terms: ["solutions architect", "systems architect", "enterprise architect", "systems integration architect"],
      ecosystem: "enterprise architecture systems integration technology organizations"
    },
    {
      key: "information-knowledge",
      name: "Information & Knowledge",
      terms: ["information architect", "knowledge architect", "knowledge engineer", "knowledge management architect"],
      ecosystem: "knowledge architecture information architecture knowledge engineering companies"
    },
    {
      key: "applied-ai",
      name: "Applied AI Architecture",
      terms: ["AI solutions architect", "enterprise AI architect", "AI platform architect", "agentic systems architect"],
      ecosystem: "applied AI enterprise AI architecture organizations"
    },
    {
      key: "ai-enablement",
      name: "AI Enablement & Stewardship",
      terms: ["AI enablement", "responsible AI architect", "AI governance architect", "human centered AI"],
      ecosystem: "responsible AI human centered AI AI enablement organizations"
    },
    {
      key: "technical-strategy",
      name: "Technical Strategy",
      terms: ["technical strategy", "technology strategy architect", "platform strategy", "digital transformation architect"],
      ecosystem: "technology strategy architecture transformation organizations"
    },
    {
      key: "domain-bridge",
      name: "Telecom / Domain Bridge",
      terms: ["telecom solutions architect", "network automation architect", "OSS architect", "network telemetry architect"],
      ecosystem: "telecommunications network automation OSS optical networking companies"
    }
  ],

  Sam: [
    {
      key: "funeral-service",
      name: "Funeral Service & Celebrancy",
      terms: ["funeral celebrant", "certified celebrant funeral", "funeral service", "celebration of life coordinator"],
      ecosystem: "funeral homes celebrants memorial services"
    },
    {
      key: "green-burial",
      name: "Green & Natural Burial",
      terms: ["green burial", "natural burial", "conservation burial", "green cemetery"],
      ecosystem: "green cemeteries natural burial conservation burial organizations"
    },
    {
      key: "end-of-life",
      name: "End-of-Life / Death Doula",
      terms: ["end of life doula", "death doula", "end of life care coordinator", "deathcare educator"],
      ecosystem: "end of life doula death positive community organizations"
    },
    {
      key: "hospice-grief",
      name: "Hospice, Bereavement & Grief",
      terms: ["hospice bereavement", "grief support coordinator", "bereavement specialist", "family support hospice"],
      ecosystem: "hospice bereavement grief support organizations"
    },
    {
      key: "planning-memorial",
      name: "Planning & Memorialization",
      terms: ["end of life planning", "memorial planner", "celebration of life services", "advance care planning"],
      ecosystem: "end of life planning memorialization community services"
    },
    {
      key: "professional-community",
      name: "Professional Communities & Training",
      terms: ["death doula training", "green burial council", "funeral celebrant association", "death positive community"],
      ecosystem: "end of life professional associations training communities"
    },
    {
      key: "downsizing-estates",
      name: "Downsizing & Estate Transitions",
      terms: [
        "senior move manager",
        "downsizing specialist",
        "estate sale coordinator",
        "estate cleanout specialist",
        "estate liquidation",
        "home transition specialist"
      ],
      ecosystem: "senior move management downsizing estate sales estate cleanouts estate liquidation home transition services"
    }
  ],

  Us: [
    {
      key: "land-home",
      name: "Home + Land",
      terms: ["homes 3 acres", "rural homes acreage", "small town homes land", "country homes"],
      ecosystem: "rural housing acreage communities"
    },
    {
      key: "outdoors-community",
      name: "Outdoors + Community",
      terms: ["hiking kayaking trails", "small town arts community", "outdoor recreation", "walkable small town"],
      ecosystem: "outdoor recreation community small towns"
    },
    {
      key: "access",
      name: "Airports, Healthcare & Access",
      terms: ["regional airport access", "major hospital", "healthcare systems", "commute to technology jobs"],
      ecosystem: "airport healthcare regional access"
    },
    {
      key: "climate",
      name: "Climate & Seasons",
      terms: ["summer climate", "winter snowfall", "climate normals", "heat humidity"],
      ecosystem: "climate weather seasonal living"
    },
    {
      key: "scouting",
      name: "Scouting Trip",
      terms: ["things to do", "local restaurants", "neighborhood guide", "weekend itinerary"],
      ecosystem: "visit explore local community"
    }
  ]
}
};
