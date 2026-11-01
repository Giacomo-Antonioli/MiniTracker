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
  <forceEntries>
    <forceEntry id="f-crusade" name="Crusade Force" hidden="false"/>
    <forceEntry id="f-army" name="Army Roster" hidden="false">
      <categoryLinks>
        <categoryLink id="fl-char" name="Character" hidden="false" targetId="c-char" primary="false">
          <constraints>
            <constraint type="min" value="1" field="selections" scope="roster" shared="true" id="min-char"/>
          </constraints>
          <modifiers>
            <modifier type="set" value="0" field="min-char">
              <conditionGroups>
                <conditionGroup type="or">
                  <conditions>
                    <condition type="instanceOf" value="1" field="selections" scope="primary-catalogue" childId="cat-sub" shared="true"/>
                  </conditions>
                </conditionGroup>
              </conditionGroups>
            </modifier>
          </modifiers>
        </categoryLink>
        <categoryLink id="fl-inf" name="Infantry" hidden="false" targetId="c-inf" primary="false"/>
      </categoryLinks>
    </forceEntry>
  </forceEntries>
  <sharedSelectionEntries>
    <selectionEntry type="upgrade" import="true" name="Battle Size" hidden="false" id="e-bs">
      <selectionEntryGroups>
        <selectionEntryGroup name="Battle Size" hidden="false" id="g-bs">
          <selectionEntries>
            <selectionEntry type="upgrade" import="true" name="2. Strike Force (2000 Point limit)" hidden="false" id="bs-sf"/>
            <selectionEntry type="upgrade" import="true" name="1. Incursion (1000 Point limit)" hidden="false" id="bs-inc"/>
            <selectionEntry type="upgrade" import="true" name="Something else" hidden="false" id="bs-x"/>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>
  </sharedSelectionEntries>
</gameSystem>
