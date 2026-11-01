<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!-- Hand-written sample in BattleScribe format for tests. Not real game data. -->
<gameSystem xmlns="http://www.battlescribe.net/schema/gameSystemSchema" id="sys-test" name="Test Game" revision="3" battleScribeVersion="2.03" type="gameSystem">
  <costTypes>
    <costType id="pts-id" name="pts" defaultCostLimit="-1" hidden="false"/>
    <costType id="xp-id" name="Experience" defaultCostLimit="-1" hidden="true"/>
  </costTypes>
  <sharedRules>
    <rule id="r-assault" name="Assault" hidden="false">
      <description>Weapons with **[ASSAULT]** can shoot after Advancing.</description>
      <alias>ASSAULT</alias>
    </rule>
    <rule id="r-sustained" name="Sustained Hits" hidden="false">
      <description>Each Critical Hit scores extra hits.</description>
    </rule>
    <rule id="r-deepstrike" name="Deep Strike" hidden="false">
      <description>This unit can be set up in Reserves.</description>
    </rule>
  </sharedRules>
</gameSystem>
