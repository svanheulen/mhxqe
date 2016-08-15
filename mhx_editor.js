function readString(view) {
    var decoder = new TextDecoder();
    var string = decoder.decode(view);
    var end = string.indexOf("\0");
    if (end < 0) {
        return string;
    }
    return string.slice(0, end);
}

function writeString(view, string) {
    var encoder = new TextEncoder();
    var data = encoder.encode(string);
    if (data.length > view.length) {
        var new_length = data.length;
        while (new_length > length || (data[new_length - 1] & 0xc0) == 0x80) {
            new_length--;
        }
        data = data.subarray(0, new_length);
    }
    view.fill(0);
    view.set(data, 0);
}

function readHex(view) {
    var string = "";
    view.forEach(function (element, index, array) {
        if (element < 16) {
            string += "0";
        }
        string += element.toString(16);
    });
    return string;
}

function writeHex(view, string) {
    if (view.length * 2 == string.length) {
        for (var i = 0; i < view.length; i++) {
            view[i] = parseInt(string.substr(i*2, 2), 16);
        }
    }
}

function linkInput(element, type, buffer, offset, length) {
    switch (type) {
        case "char":
            var item = new Uint8Array(buffer, offset, 1);
            if (element.type == "checkbox") {
                element.checked = item[0];
                element.onchange = function (event) {
                    this[0] = event.currentTarget.checked;
                }.bind(item);
            } else {
                if (element.type == "number") {
                    element.min = 0;
                    element.max = 0xff;
                }
                element.value = item[0];
                element.onchange = function (event) {
                    this[0] = event.currentTarget.value;
                }.bind(item);
            }
            break;
        case "short":
            var item = new DataView(buffer, offset, 2);
            if (element.type == "number") {
                element.min = 0;
                element.max = 0xffff;
            }
            element.value = item.getUint16(0, true);
            element.onchange = function (event) {
                this.setUint16(0, event.currentTarget.value, true);
            }.bind(item);
            break;
        case "int":
            var item = new DataView(buffer, offset, 4);
            if (element.type == "number") {
                element.min = 0;
                element.max = 0xffffffff;
            }
            element.value = item.getUint32(0, true);
            element.onchange = function (event) {
                this.setUint32(0, event.currentTarget.value, true);
            }.bind(item);
            return element;
        case "float":
            var item = new DataView(buffer, offset, 4);
            element.value = item.getFloat32(0, true);
            element.onchange = function (event) {
                this.setFloat32(0, event.currentTarget.value, true);
            }.bind(item);
            break;
        case "string":
            var item = new Uint8Array(buffer, offset, length);
            element.maxLength = length;
            element.size = length;
            element.value = readString(item);
            element.onchange = function (event) {
                writeString(this, event.currentTarget.value);
            }.bind(item);
            return element;
        case "hex":
            var item = new Uint8Array(buffer, offset, length);
            element.pattern = "[0-9a-fA-F]{" + (length * 2) + "}";
            element.maxLength = length * 2;
            element.size = length * 2;
            element.value = readHex(item);
            element.onchange = function (event) {
                writeHex(this, event.currentTarget.value);
            }.bind(item);
            return element;
    }
}

function linkInputSpecial(checkbox, dropdown, buffer, offset) {
    var item = new Uint8Array(buffer, offset, 1);
    checkbox.value = (item[0] < 120) ? item[0] : (item[0] - 120);
    checkbox.checked = (item[0] >= 120) ? 1 : 0;
    checkbox.onchange = function (event) {
        if (event.currentTarget.checked == 1) {
            this[0] = parseInt(event.currentTarget.value, 10) + 120;
        } else {
            this[0] = event.currentTarget.value;
        }
    }.bind(item);
    dropdown.value = (item[0] < 120) ? item[0] : (item[0] - 120);
    dropdown.onchange = function (event) {
        this.value = event.currentTarget.value;
        this.dispatchEvent(new Event("change", {}));
    }.bind(checkbox);
}

function linkObjective(target, element) {
    target.addEventListener("change", function (event) {
        switch (parseInt(event.currentTarget.value, 10)) {
            case 1:
            case 2:
            case 4:
            case 8:
            case 9:
                fillSelect(element, monster_list);
                break;
            case 5:
                fillSelect(element, item_list);
                break;
            default:
                fillSelect(element, [{"text": "NA", "value": 0}]);
        }
    }.bind(element));
}

function linkCondition(target, element) {
    target.addEventListener("change", function (event) {
        switch (parseInt(event.currentTarget.value)) {
            case 2:
                fillSelect(element, monster_list);
                break;
            case 3:
                fillSelect(element, item_list);
                break;
            default:
                fillSelect(element, [{"text": "NA", "value": 0}]);
        }
    }.bind(element));
}

function fillSelect(element, list) {
    while (element.firstElementChild) {
        element.removeChild(element.firstElementChild);
    }
    for (var i = 0; i < list.length; i++) {
        var option = element.appendChild(document.createElement("option"));
        option.value = list[i]["value"];
        option.text = list[i]["text"];
    }
}

var rArchive = function (raw_data) {
    this.files = [];
    if (raw_data == null) {
        return;
    }
    var view = new DataView(raw_data);
    var magic = view.getUint32(0, true);
    var version = view.getUint16(4, true);
    var count = view.getUint16(6, true);
    //var unknown = view.getUint32(8, true);
    if (magic != 0x435241) {
        return; // error: invalid magic
    }
    if (version != 0x11) {
        return; // error: invalid version
    }
    for (var i = 0; i < count; i++) {
        var offset = i * 0x50 + 12;
        var file_name = readString(new Uint8Array(raw_data, offset, 0x40));
        var file_type = view.getUint32(offset + 0x40, true);
        var file_compressed_size = view.getUint32(offset + 0x44, true);
        var file_size = view.getUint32(offset + 0x48, true) & 0x1fffffff;
        //var unknown = view.getUint32(offset + 0x48, true) >> 29;
        var file_offset = view.getUint32(offset + 0x4c, true);
        var file_data = new Uint8Array(raw_data, file_offset, file_compressed_size);
        file_data = pako.inflate(file_data).buffer;
        if (file_data.byteLength != file_size) {
            continue; // error: wrong decompressed size
        }
        switch (file_type) {
            case rQuestData.prototype.file_type:
                this.files.push(new rQuestData(file_data, file_name));
                break;
            case rGUIMessage.prototype.file_type:
                this.files.push(new rGUIMessage(file_data, file_name));
                break;
            case rSetEmMain.prototype.file_type:
                this.files.push(new rSetEmMain(file_data, file_name));
                break;
            case rEmSetList.prototype.file_type:
                this.files.push(new rEmSetList(file_data, file_name));
                break;
            case rRem.prototype.file_type:
                this.files.push(new rRem(file_data, file_name));
                break;
            case rSupplyList.prototype.file_type:
                this.files.push(new rSupplyList(file_data, file_name));
                break;
            default:
                continue; // error: unknown file type
        }
    }
}

rArchive.prototype.getRaw = function () {
    var buffer = new ArrayBuffer(0xc + this.files.length * 0x50);
    var view = new DataView(buffer);
    view.setUint32(0, 0x435241, true);
    view.setUint16(4, 0x11, true);
    view.setUint16(6, this.files.length, true);
    for (var i = 0; i < this.files.length; i++) {
        view = new DataView(buffer, 0xc + i * 0x50);
        writeString(new Uint8Array(buffer, 0xc + i * 0x50, 0x40), this.files[i].file_name);
        view.setUint32(0x40, this.files[i].file_type, true);
        var data = this.files[i].getRaw();
        view.setUint32(0x48, data.byteLength | 0x40000000, true);
        data = pako.deflate(data);
        view.setUint32(0x44, data.length, true);
        view.setUint32(0x4c, buffer.byteLength, true);
        view = new Uint8Array(buffer.byteLength + data.length);
        view.set(new Uint8Array(buffer));
        view.set(data, buffer.byteLength);
        buffer = view.buffer;
    }
    return buffer;
}

rArchive.prototype.loadFile = function () {
    document.getElementById("archive").className = "hidden";
    document.getElementById("quest_data").className = "hidden";
    document.getElementById("gui_message").className = "hidden";
    document.getElementById("set_em_main").className = "hidden";
    document.getElementById("em_set_list").className = "hidden";
    document.getElementById("rem").className = "hidden";
    document.getElementById("supply_list").className = "hidden";
    var table_body = document.getElementById("archive").getElementsByTagName("tbody")[0];
    while (table_body.firstElementChild) {
        table_body.removeChild(table_body.firstElementChild);
    }
    for (var i = 0; i < this.files.length; i++) {
        var new_row = table_body.appendChild(document.createElement("tr"));
        var new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("select"));
        fillSelect(new_element, file_type_list);
        new_element.value = this.files[i].file_type;
        new_element.disabled = "true";
        new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("input"));
        new_element.type = "text";
        new_element.value = this.files[i].file_name;
        new_element.onchange = function (event) {
            this.file_name = event.currentTarget.value;
        }.bind(this.files[i]);
        new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("input"));
        new_element.type = "button";
        new_element.value = " > ";
        new_element.onclick = function (event) {
            this.loadFile();
        }.bind(this.files[i]);
        new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("input"));
        new_element.type = "button";
        new_element.value = " - ";
        new_element.onclick = function (event) {
            archive.files.splice(archive.files.indexOf(this), 1);
            archive.loadFile();
        }.bind(this.files[i]);
        new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("input"));
        new_element.type = "button";
        new_element.value = " ^ ";
        if (i == 0) {
            new_element.disabled = "true";
        } else {
            new_element.onclick = function (event) {
                var file_index = archive.files.indexOf(this);
                var temp_file = archive.files[file_index];
                archive.files[file_index] = archive.files[file_index - 1];
                archive.files[file_index - 1] = temp_file;
                archive.loadFile();
            }.bind(this.files[i]);
        }
        new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("input"));
        new_element.type = "button";
        new_element.value = " v ";
        if (i == this.files.length - 1) {
            new_element.disabled = "true";
        } else {
            new_element.onclick = function (event) {
                var file_index = archive.files.indexOf(this);
                var temp_file = archive.files[file_index];
                archive.files[file_index] = archive.files[file_index + 1];
                archive.files[file_index + 1] = temp_file;
                archive.loadFile();
            }.bind(this.files[i]);
        }
    }
    document.getElementById("archive").removeAttribute("class");
}

rArchive.prototype.addFile = function (file_type) {
    switch (parseInt(file_type, 10)) {
        case rQuestData.prototype.file_type:
            this.files.push(new rQuestData(null, "quest\\questData\\questData_1010001"));
            break;
        case rGUIMessage.prototype.file_type:
            this.files.push(new rGUIMessage(null, "quest\\questData\\questData_1010001_jpn"));
            break;
        case rSetEmMain.prototype.file_type:
            this.files.push(new rSetEmMain(null, "quest\\boss\\setEmMain\\b_m00em000_00"));
            break;
        case rEmSetList.prototype.file_type:
            this.files.push(new rEmSetList(null, "quest\\zako\\emSetList\\z_m00d_000"));
            break;
        case rRem.prototype.file_type:
            this.files.push(new rRem(null, "quest\\rem\\rem_000000"));
            break;
        case rSupplyList.prototype.file_type:
            this.files.push(new rSupplyList(null, "quest\\supp\\supp_1010001"));
            break;
    }
    this.loadFile();
}

var rQuestData = function (raw_data, file_name) {
    this.file_name = file_name;
    this.quests = [];
    if (raw_data == null) {
        var raw_data = new ArrayBuffer(0x530);
        var view = new DataView(raw_data);
        view.setUint32(4, 1010001, true);
        view.setUint8(9, 10, true);
        view.setUint8(0xa, 1, true);
        view.setUint8(0xc, 1, true);
        view.setUint32(0x130, rGUIMessage.prototype.file_type, true);
        view.setUint32(0x174, rSetEmMain.prototype.file_type, true);
        view.setUint32(0x1b8, rSetEmMain.prototype.file_type, true);
        view.setUint32(0x1fC, rSetEmMain.prototype.file_type, true);
        view.setUint32(0x240, rSetEmMain.prototype.file_type, true);
        view.setUint32(0x284, rSetEmMain.prototype.file_type, true);
        view.setUint32(0x2c8, rEmSetList.prototype.file_type, true);
        view.setUint32(0x30C, rEmSetList.prototype.file_type, true);
        view.setUint32(0x350, rEmSetList.prototype.file_type, true);
        view.setUint32(0x394, rRem.prototype.file_type, true);
        view.setUint32(0x3d8, rRem.prototype.file_type, true);
        view.setUint32(0x41C, rRem.prototype.file_type, true);
        view.setUint32(0x460, rRem.prototype.file_type, true);
        view.setUint32(0x4a4, rRem.prototype.file_type, true);
        view.setUint32(0x4e8, rSupplyList.prototype.file_type, true);
        this.quests.push(raw_data);
        return;
    }
    var view = new DataView(raw_data);
    var magic = view.getUint32(0, true);
    var count = view.getUint32(4, true);
    if (magic != 0x4348999a) {
        return; // error: invalid magic
    }
    for (var i = 0; i < count; i++) {
        var offset = i * 0x530 + 8;
        this.quests.push(raw_data.slice(offset, offset + 0x530));
    }
}

rQuestData.prototype.file_type = 0x1bbfd18e;

rQuestData.prototype.getRaw = function() {
    var buffer = new ArrayBuffer(8 + this.quests.length * 0x530);
    var view = new DataView(buffer);
    view.setUint32(0, 0x4348999a, true);
    view.setUint32(4, this.quests.length, true);
    for (var i = 0; i < this.quests.length; i++) {
        view = new Uint8Array(buffer, 8 + i * 0x530);
        view.set(new Uint8Array(this.quests[i]));
    }
    return buffer;
}

rQuestData.prototype.loadFile = function () {
    document.getElementById("quest_data").className = "hidden";
    document.getElementById("gui_message").className = "hidden";
    document.getElementById("set_em_main").className = "hidden";
    document.getElementById("em_set_list").className = "hidden";
    document.getElementById("rem").className = "hidden";
    document.getElementById("supply_list").className = "hidden";
    linkInput(document.getElementById("mIndex"), "int", this.quests[0], 0);
    linkInput(document.getElementById("mQuestNo"), "int", this.quests[0], 4);
    linkInput(document.getElementById("mQuestType"), "char", this.quests[0], 8);
    linkInput(document.getElementById("mRequestVillage"), "char", this.quests[0], 9);
    linkInput(document.getElementById("mQuestLv"), "char", this.quests[0], 0xa);
    linkInput(document.getElementById("mMonsterLv"), "char", this.quests[0], 0xb);
    linkInput(document.getElementById("mMapNo"), "char", this.quests[0], 0xc);
    linkInput(document.getElementById("mStartType"), "char", this.quests[0], 0xd);
    linkInput(document.getElementById("mQuestTime"), "char", this.quests[0], 0xe);
    linkInput(document.getElementById("mQuestLife"), "char", this.quests[0], 0xf);
    linkInput(document.getElementById("mAcEquipSetNo"), "char", this.quests[0], 0x10);
    linkInput(document.getElementById("mBGMType"), "char", this.quests[0], 0x11);
    linkInput(document.getElementById("mEntryType_1"), "char", this.quests[0], 0x12);
    linkInput(document.getElementById("mEntryType_2"), "char", this.quests[0], 0x13);
    linkInput(document.getElementById("mEntryType_Combo"), "char", this.quests[0], 0x14);
    linkInput(document.getElementById("mIsEmergency"), "char", this.quests[0], 0x15);
    linkInput(document.getElementById("mIsRandomAppear"), "char", this.quests[0], 0x16);
    linkInput(document.getElementById("mIsClearRandomAppear"), "char", this.quests[0], 0x17);
    linkInput(document.getElementById("mIsIntrude"), "char", this.quests[0], 0x18);
    linkInput(document.getElementById("mIsRepulse"), "char", this.quests[0], 0x19);
    linkInput(document.getElementById("mIsClearTimeup"), "char", this.quests[0], 0x1a);
    linkInput(document.getElementById("mIsReturn20Sec"), "char", this.quests[0], 0x1b);
    linkInput(document.getElementById("mIsNoCountQuest"), "char", this.quests[0], 0x1c);
    linkInput(document.getElementById("mIsAppearJiji"), "char", this.quests[0], 0x1d);
    linkInput(document.getElementById("mIsAppearNyan"), "char", this.quests[0], 0x1e);
    linkInput(document.getElementById("mIsExtraQuest"), "char", this.quests[0], 0x1f);
    linkInput(document.getElementById("mIsRepulseNotKill"), "char", this.quests[0], 0x20);
    linkInput(document.getElementById("mClearType"), "char", this.quests[0], 0x21);
    linkInput(document.getElementById("mGekitaiHp"), "char", this.quests[0], 0x22);
    linkInput(document.getElementById("mIsClearParam_1"), "char", this.quests[0], 0x23);
    document.getElementById("mIsClearParam_1").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mClearID_1"), "short", this.quests[0], 0x24);
    linkInput(document.getElementById("mClearNum_1"), "short", this.quests[0], 0x26);
    linkInput(document.getElementById("mClearParam_2"), "int", this.quests[0], 0x28);
    document.getElementById("mClearParam_2").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mClearID_2"), "short", this.quests[0], 0x2c);
    linkInput(document.getElementById("mClearNum_2"), "short", this.quests[0], 0x2e);
    linkInput(document.getElementById("mSubClearType"), "int", this.quests[0], 0x30);
    document.getElementById("mSubClearType").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mClearID_Sub"), "short", this.quests[0], 0x34);
    linkInput(document.getElementById("mClearNum_Sub"), "short", this.quests[0], 0x36);
    linkInput(document.getElementById("mHagiLv"), "char", this.quests[0], 0x38);
    linkInput(document.getElementById("mPickLv"), "char", this.quests[0], 0x39);
    linkInput(document.getElementById("mFishingLv"), "char", this.quests[0], 0x3a);
    linkInput(document.getElementById("mContract"), "int", this.quests[0], 0x3b);
    linkInput(document.getElementById("mVillagePoint"), "int", this.quests[0], 0x3f);
    linkInput(document.getElementById("mRemMoney"), "int", this.quests[0], 0x43);
    linkInput(document.getElementById("mSubRemMoney"), "int", this.quests[0], 0x47);
    linkInput(document.getElementById("mClearRemVillagePoint"), "int", this.quests[0], 0x4b);
    linkInput(document.getElementById("mFailedRemVillagePoint"), "int", this.quests[0], 0x4f);
    linkInput(document.getElementById("mSubRemVillagePoint"), "int", this.quests[0], 0x53);
    linkInput(document.getElementById("mClearRemHuterPoint"), "int", this.quests[0], 0x57);
    linkInput(document.getElementById("mSubRemHuterPoint"), "int", this.quests[0], 0x5b);
    linkInput(document.getElementById("mRemAddFrame_1"), "char", this.quests[0], 0x5f);
    linkInput(document.getElementById("mRemAddFrame_2"), "char", this.quests[0], 0x60);
    linkInput(document.getElementById("mRemAddLotMax"), "char", this.quests[0], 0x61);
    linkInput(document.getElementById("mSuppLabel_1"), "char", this.quests[0], 0x62);
    linkInput(document.getElementById("mSuppType_1"), "char", this.quests[0], 0x63);
    document.getElementById("mSuppType_1").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mSuppTarget_1"), "int", this.quests[0], 0x64);
    linkInput(document.getElementById("mSuppTargetNum_1"), "int", this.quests[0], 0x68);
    linkInput(document.getElementById("mSuppLabel_2"), "char", this.quests[0], 0x6c);
    linkInput(document.getElementById("mSuppType_2"), "char", this.quests[0], 0x6d);
    document.getElementById("mSuppType_2").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mSuppTarget_2"), "int", this.quests[0], 0x6e);
    linkInput(document.getElementById("mSuppTargetNum_2"), "int", this.quests[0], 0x72);
    linkInput(document.getElementById("mEmType_1"), "int", this.quests[0], 0x76);
    linkInput(document.getElementById("mEmSubType_1"), "int", this.quests[0], 0x7a);
    linkInput(document.getElementById("mAuraType_1"), "char", this.quests[0], 0x7e);
    linkInput(document.getElementById("mRestoreNum_1"), "int", this.quests[0], 0x7f);
    linkInput(document.getElementById("mVitalTblNo_1"), "char", this.quests[0], 0x83);
    linkInput(document.getElementById("mAttackTblNo_1"), "char", this.quests[0], 0x84);
    linkInput(document.getElementById("mOtherTblNo_1"), "char", this.quests[0], 0x85);
    linkInput(document.getElementById("mDifficulty_1"), "char", this.quests[0], 0x86);
    linkInput(document.getElementById("mScale_1"), "short", this.quests[0], 0x87);
    linkInput(document.getElementById("mScaleTbl_1"), "char", this.quests[0], 0x89);
    linkInput(document.getElementById("mStaminaTbl_1"), "char", this.quests[0], 0x8a);
    linkInput(document.getElementById("mEmType_2"), "int", this.quests[0], 0x8b);
    linkInput(document.getElementById("mEmSubType_2"), "int", this.quests[0], 0x8f);
    linkInput(document.getElementById("mAuraType_2"), "char", this.quests[0], 0x93);
    linkInput(document.getElementById("mRestoreNum_2"), "int", this.quests[0], 0x94);
    linkInput(document.getElementById("mVitalTblNo_2"), "char", this.quests[0], 0x98);
    linkInput(document.getElementById("mAttackTblNo_2"), "char", this.quests[0], 0x99);
    linkInput(document.getElementById("mOtherTblNo_2"), "char", this.quests[0], 0x9a);
    linkInput(document.getElementById("mDifficulty_2"), "char", this.quests[0], 0x9b);
    linkInput(document.getElementById("mScale_2"), "short", this.quests[0], 0x9c);
    linkInput(document.getElementById("mScaleTbl_2"), "char", this.quests[0], 0x9e);
    linkInput(document.getElementById("mStaminaTbl_2"), "char", this.quests[0], 0x9f);
    linkInput(document.getElementById("mEmType_3"), "int", this.quests[0], 0xa0);
    linkInput(document.getElementById("mEmSubType_3"), "int", this.quests[0], 0xa4);
    linkInput(document.getElementById("mAuraType_3"), "char", this.quests[0], 0xa8);
    linkInput(document.getElementById("mRestoreNum_3"), "int", this.quests[0], 0xa9);
    linkInput(document.getElementById("mVitalTblNo_3"), "char", this.quests[0], 0xad);
    linkInput(document.getElementById("mAttackTblNo_3"), "char", this.quests[0], 0xae);
    linkInput(document.getElementById("mOtherTblNo_3"), "char", this.quests[0], 0xaf);
    linkInput(document.getElementById("mDifficulty_3"), "char", this.quests[0], 0xb0);
    linkInput(document.getElementById("mScale_3"), "short", this.quests[0], 0xb1);
    linkInput(document.getElementById("mScaleTbl_3"), "char", this.quests[0], 0xb3);
    linkInput(document.getElementById("mStaminaTbl_3"), "char", this.quests[0], 0xb4);
    linkInput(document.getElementById("mEmType_4"), "int", this.quests[0], 0xb5);
    linkInput(document.getElementById("mEmSubType_4"), "int", this.quests[0], 0xb9);
    linkInput(document.getElementById("mAuraType_4"), "char", this.quests[0], 0xbd);
    linkInput(document.getElementById("mRestoreNum_4"), "int", this.quests[0], 0xbe);
    linkInput(document.getElementById("mVitalTblNo_4"), "char", this.quests[0], 0xc2);
    linkInput(document.getElementById("mAttackTblNo_4"), "char", this.quests[0], 0xc3);
    linkInput(document.getElementById("mOtherTblNo_4"), "char", this.quests[0], 0xc4);
    linkInput(document.getElementById("mDifficulty_4"), "char", this.quests[0], 0xc5);
    linkInput(document.getElementById("mScale_4"), "short", this.quests[0], 0xc6);
    linkInput(document.getElementById("mScaleTbl_4"), "char", this.quests[0], 0xc8);
    linkInput(document.getElementById("mStaminaTbl_4"), "char", this.quests[0], 0xc9);
    linkInput(document.getElementById("mEmType_5"), "int", this.quests[0], 0xca);
    linkInput(document.getElementById("mEmSubType_5"), "int", this.quests[0], 0xce);
    linkInput(document.getElementById("mAuraType_5"), "char", this.quests[0], 0xd2);
    linkInput(document.getElementById("mRestoreNum_5"), "int", this.quests[0], 0xd3);
    linkInput(document.getElementById("mVitalTblNo_5"), "char", this.quests[0], 0xd7);
    linkInput(document.getElementById("mAttackTblNo_5"), "char", this.quests[0], 0xd8);
    linkInput(document.getElementById("mOtherTblNo_5"), "char", this.quests[0], 0xd9);
    linkInput(document.getElementById("mDifficulty_5"), "char", this.quests[0], 0xda);
    linkInput(document.getElementById("mScale_5"), "short", this.quests[0], 0xdb);
    linkInput(document.getElementById("mScaleTbl_5"), "char", this.quests[0], 0xdd);
    linkInput(document.getElementById("mStaminaTbl_5"), "char", this.quests[0], 0xde);
    linkInput(document.getElementById("mZakoHP"), "int", this.quests[0], 0xdf);
    linkInput(document.getElementById("mZakoAttack"), "int", this.quests[0], 0xe3);
    linkInput(document.getElementById("mZakoOther"), "int", this.quests[0], 0xe7);
    linkInput(document.getElementById("mNoZako"), "char", this.quests[0], 0xeb);
    linkInput(document.getElementById("mEmSetType_2"), "char", this.quests[0], 0xec);
    document.getElementById("mEmSetType_2").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mEmSetTargetID_2"), "int", this.quests[0], 0xed);
    linkInput(document.getElementById("mEmSetTargetNum_2"), "int", this.quests[0], 0xf1);
    linkInput(document.getElementById("mEmSetType_3"), "char", this.quests[0], 0xf5);
    document.getElementById("mEmSetType_3").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mEmSetTargetID_3"), "int", this.quests[0], 0xf6);
    linkInput(document.getElementById("mEmSetTargetNum_3"), "int", this.quests[0], 0xfa);
    linkInput(document.getElementById("mBossRushType"), "char", this.quests[0], 0xfe);
    linkInput(document.getElementById("mAppearType_1"), "char", this.quests[0], 0xff);
    document.getElementById("mAppearType_1").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mAppearTargetType_1"), "int", this.quests[0], 0x100);
    linkInput(document.getElementById("mAppearTargetNum_1"), "int", this.quests[0], 0x104);
    linkInput(document.getElementById("mAppearType_2"), "char", this.quests[0], 0x108);
    document.getElementById("mAppearType_2").dispatchEvent(new Event("change", {}));
    linkInput(document.getElementById("mAppearTargetType_2"), "int", this.quests[0], 0x109);
    linkInput(document.getElementById("mAppearTargetNum_2"), "int", this.quests[0], 0x10d);
    linkInput(document.getElementById("mExtraRand"), "char", this.quests[0], 0x111);
    linkInput(document.getElementById("mExtraStartTime"), "char", this.quests[0], 0x112);
    linkInput(document.getElementById("mExtraStartRand"), "char", this.quests[0], 0x113);
    linkInput(document.getElementById("mExtraLimit_3"), "char", this.quests[0], 0x114);
    linkInput(document.getElementById("mExtraLimit_4"), "char", this.quests[0], 0x115);
    linkInput(document.getElementById("mExtraLimit_5"), "char", this.quests[0], 0x116);
    linkInput(document.getElementById("mExtraRand_3"), "char", this.quests[0], 0x117);
    linkInput(document.getElementById("mExtraRand_4"), "char", this.quests[0], 0x118);
    linkInput(document.getElementById("mExtraRand_5"), "char", this.quests[0], 0x119);
    linkInput(document.getElementById("mIsGekiryu"), "char", this.quests[0], 0x11a);
    linkInput(document.getElementById("mIsRail"), "char", this.quests[0], 0x11b);
    linkInput(document.getElementById("mIsRailStart"), "char", this.quests[0], 0x11c);
    linkInput(document.getElementById("mRailOpenTime"), "short", this.quests[0], 0x11d);
    linkInput(document.getElementById("mRailStartTime"), "short", this.quests[0], 0x11f);
    linkInput(document.getElementById("mRailReuseTime"), "short", this.quests[0], 0x121);
    linkInput(document.getElementById("mGekiryuStartTime"), "short", this.quests[0], 0x123);
    linkInput(document.getElementById("mGekiryuReuseTime"), "short", this.quests[0], 0x125);
    linkInputSpecial(document.getElementById("mIcon_1_hyper"), document.getElementById("mIcon_1"), this.quests[0], 0x127);
    linkInputSpecial(document.getElementById("mIcon_2_hyper"), document.getElementById("mIcon_2"), this.quests[0], 0x128);
    linkInputSpecial(document.getElementById("mIcon_3_hyper"), document.getElementById("mIcon_3"), this.quests[0], 0x129);
    linkInputSpecial(document.getElementById("mIcon_4_hyper"), document.getElementById("mIcon_4"), this.quests[0], 0x12a);
    linkInputSpecial(document.getElementById("mIcon_5_hyper"), document.getElementById("mIcon_5"), this.quests[0], 0x12b);
    linkInput(document.getElementById("mProgNo"), "int", this.quests[0], 0x12c);
    linkInput(document.getElementById("mMessage_type"), "int", this.quests[0], 0x130);
    linkInput(document.getElementById("mMessage_name"), "string", this.quests[0], 0x134, 0x40);
    linkInput(document.getElementById("mBossSetRes_1_type"), "int", this.quests[0], 0x174);
    linkInput(document.getElementById("mBossSetRes_1_name"), "string", this.quests[0], 0x178, 0x40);
    linkInput(document.getElementById("mBossSetRes_2_type"), "int", this.quests[0], 0x1b8);
    linkInput(document.getElementById("mBossSetRes_2_name"), "string", this.quests[0], 0x1bc, 0x40);
    linkInput(document.getElementById("mBossSetRes_3_type"), "int", this.quests[0], 0x1fc);
    linkInput(document.getElementById("mBossSetRes_3_name"), "string", this.quests[0], 0x200, 0x40);
    linkInput(document.getElementById("mBossSetRes_4_type"), "int", this.quests[0], 0x240);
    linkInput(document.getElementById("mBossSetRes_4_name"), "string", this.quests[0], 0x244, 0x40);
    linkInput(document.getElementById("mBossSetRes_5_type"), "int", this.quests[0], 0x284);
    linkInput(document.getElementById("mBossSetRes_5_name"), "string", this.quests[0], 0x288, 0x40);
    linkInput(document.getElementById("mEmSetListRes_1_type"), "int", this.quests[0], 0x2c8);
    linkInput(document.getElementById("mEmSetListRes_1_name"), "string", this.quests[0], 0x2cc, 0x40);
    linkInput(document.getElementById("mEmSetListRes_2_type"), "int", this.quests[0], 0x30c);
    linkInput(document.getElementById("mEmSetListRes_2_name"), "string", this.quests[0], 0x310, 0x40);
    linkInput(document.getElementById("mEmSetListRes_3_type"), "int", this.quests[0], 0x350);
    linkInput(document.getElementById("mEmSetListRes_3_name"), "string", this.quests[0], 0x354, 0x40);
    linkInput(document.getElementById("mRemTbl_1_type"), "int", this.quests[0], 0x394);
    linkInput(document.getElementById("mRemTbl_1_name"), "string", this.quests[0], 0x398, 0x40);
    linkInput(document.getElementById("mRemTbl_2_type"), "int", this.quests[0], 0x3d8);
    linkInput(document.getElementById("mRemTbl_2_name"), "string", this.quests[0], 0x3dc, 0x40);
    linkInput(document.getElementById("mRemTbl_Add1_type"), "int", this.quests[0], 0x41c);
    linkInput(document.getElementById("mRemTbl_Add1_name"), "string", this.quests[0], 0x420, 0x40);
    linkInput(document.getElementById("mRemTbl_Add2_type"), "int", this.quests[0], 0x460);
    linkInput(document.getElementById("mRemTbl_Add2_name"), "string", this.quests[0], 0x464, 0x40);
    linkInput(document.getElementById("mRemTbl_Sub_type"), "int", this.quests[0], 0x4a4);
    linkInput(document.getElementById("mRemTbl_Sub_name"), "string", this.quests[0], 0x4a8, 0x40);
    linkInput(document.getElementById("mSuppTbl_type"), "int", this.quests[0], 0x4e8);
    linkInput(document.getElementById("mSuppTbl_name"), "string", this.quests[0], 0x4ec, 0x40);
    linkInput(document.getElementById("mExtraTicketNum"), "int", this.quests[0], 0x52c);
    document.getElementById("quest_data").removeAttribute("class");
}


var rGUIMessage = function (raw_data, file_name) {
    this.file_name = file_name;
    this.internal_name = "questData_1010001";
    this.messages = ["", "", "", "", "", "", "", ""];
    if (raw_data == null) {
        return;
    }
    var view = new DataView(raw_data);
    var magic = view.getUint32(0, true);
    var version = view.getUint32(4, true);
    //var unknown = view.getUint32(8, true);
    //var unknown = view.getFloat64(0xc, true);
    //var unknown = view.getUint32(0x14, true);
    var message_count = view.getUint32(0x18, true);
    //var unknown = view.getUint32(0x1c, true);
    var messages_size = view.getUint32(0x20, true);
    var name_size = view.getUint32(0x24, true);
    var name = readString(new Uint8Array(raw_data, 0x28, name_size));
    if (magic != 0x444d47) {
        return; // error: invalid magic
    }
    if (version != 0x10302) {
        return; // error: invalid version
    }
    view = new DataView(raw_data, 0x28 + name_size + 1);
    if (view.byteLength != messages_size) {
        return; // error: invalid messages size
    }
    var decoder = new TextDecoder();
    var messages = decoder.decode(view).split("\0");
    messages.pop();
    if (messages.length != message_count) {
        return; // error: invalid message count
    }
    this.internal_name = name;
    this.messages = messages;
}

rGUIMessage.prototype.file_type = 0x242bb29a;

rGUIMessage.prototype.getRaw = function () {
    var encoder = new TextEncoder();
    var name = encoder.encode(this.internal_name + "\0");
    var messages = encoder.encode(this.messages.join("\0") + "\0");
    var buffer = new ArrayBuffer(0x28 + name.length + messages.length);
    var view = new Uint8Array(buffer, 0x28);
    view.set(name);
    view.set(messages, name.length);
    view = new DataView(buffer);
    view.setUint32(0, 0x444d47, true);
    view.setUint32(4, 0x10302, true);
    //view.setUint32(8, 0, true);
    view.setUint32(0xc, 0x3e32f0a0, true);
    //view.setUint32(0x14, 0, true);
    view.setUint32(0x18, this.messages.length, true);
    //view.setUint32(0x1c, 0, true);
    view.setUint32(0x20, messages.length, true);
    view.setUint32(0x24, name.length - 1, true);
    return buffer;
}

rGUIMessage.prototype.loadFile = function () {
    document.getElementById("quest_data").className = "hidden";
    document.getElementById("gui_message").className = "hidden";
    document.getElementById("set_em_main").className = "hidden";
    document.getElementById("em_set_list").className = "hidden";
    document.getElementById("rem").className = "hidden";
    document.getElementById("supply_list").className = "hidden";
    var element = document.getElementById("internal_name");
    element.value = this.internal_name;
    element.onchange = function (event) {
        this.internal_name = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("unknown");
    element.value = this.messages[0];
    element.onchange = function (event) {
        this.messages[0] = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("title");
    element.value = this.messages[1];
    element.onchange = function (event) {
        this.messages[1] = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("main_objective");
    element.rows = 2;
    element.value = this.messages[5];
    element.onchange = function (event) {
        this.messages[5] = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("subquest");
    element.value = this.messages[7];
    element.onchange = function (event) {
        this.messages[7] = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("main_monsters");
    element.rows = 2;
    element.value = this.messages[4];
    element.onchange = function (event) {
        this.messages[4] = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("failure");
    element.rows = 2;
    element.value = this.messages[6];
    element.onchange = function (event) {
        this.messages[6] = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("client");
    element.value = this.messages[2];
    element.onchange = function (event) {
        this.messages[2] = event.currentTarget.value;
    }.bind(this);
    element = document.getElementById("summary");
    element.rows = 7;
    element.value = this.messages[3];
    element.onchange = function (event) {
        this.messages[3] = event.currentTarget.value;
    }.bind(this);
    document.getElementById("gui_message").removeAttribute("class");
}


var rSetEmMain = function (raw_data, file_name) {
    this.file_name = file_name;
    this.spawns = [];
    if (raw_data == null) {
        this.spawns.push(new ArrayBuffer(0x18));
        return;
    }
    var view = new DataView(raw_data);
    var magic = view.getUint32(0, true);
    var count = view.getUint32(4, true);
    if (magic != 0x3f800000) {
        return; // error: invalid magic
    }
    for (var i = 0; i < count; i++) {
        var offset = i * 0x18 + 8;
        this.spawns.push(raw_data.slice(offset, offset + 0x18));
    }
}

rSetEmMain.prototype.file_type = 0x2553701d;

rSetEmMain.prototype.getRaw = function () {
    var buffer = new ArrayBuffer(8 + this.spawns.length * 0x18);
    var view = new DataView(buffer);
    view.setUint32(0, 0x3f800000, true);
    view.setUint32(4, this.spawns.length, true);
    for (var i = 0; i < this.spawns.length; i++) {
        view = new Uint8Array(buffer, 8 + i * 0x18);
        view.set(new Uint8Array(this.spawns[i]));
    }
    return buffer;
}

rSetEmMain.prototype.loadFile = function () {
    document.getElementById("quest_data").className = "hidden";
    document.getElementById("gui_message").className = "hidden";
    document.getElementById("set_em_main").className = "hidden";
    document.getElementById("em_set_list").className = "hidden";
    document.getElementById("rem").className = "hidden";
    document.getElementById("supply_list").className = "hidden";
    linkInput(document.getElementById("mRoundNo"), "int", this.spawns[0], 0);
    linkInput(document.getElementById("mAreaNo"), "int", this.spawns[0], 4);
    linkInput(document.getElementById("mAngle"), "float", this.spawns[0], 8);
    linkInput(document.getElementById("mPosX"), "float", this.spawns[0], 0xc);
    linkInput(document.getElementById("mPosY"), "float", this.spawns[0], 0x10);
    linkInput(document.getElementById("mPosZ"), "float", this.spawns[0], 0x14);
    document.getElementById("set_em_main").removeAttribute("class");
}

var rEmSetList = function (raw_data, file_name) {
    this.file_name = file_name;
    this.areas = [];
    for (var i = 0; i < 20; i++) {
        this.areas.push(new rEmSetData(null, 0, i));
    }
    if (raw_data == null) {
        return;
    }
    var view = new DataView(raw_data);
    var magic = view.getUint32(0, true);
    var version = view.getUint32(4, true);
    if (magic != 0x6c7365) {
        return; // error: invalid magic
    }
    if (version != 0) {
        return; // error: invalid version
    }
    for (var i = 0; i < 20; i++) {
        var offset = view.getUint32(i * 4 + 8, true);
        if (offset != 0) {
            this.areas[i] = new rEmSetData(raw_data, offset, i);
        }
    }
}

rEmSetList.prototype.file_type = 0x32ca92f8;

rEmSetList.prototype.getRaw = function () {
    var buffer = new ArrayBuffer(0x58);
    var view = new DataView(buffer);
    view.setUint32(0, 0x6c7365, true);
    view.setUint32(4, 0, true);
    for (var i = 0; i < 20; i++) {
        view = new DataView(buffer, 8 + i * 4);
        if (this.areas[i].spawns.length == 0) {
            view.setUint32(0, 0, true);
        } else {
            view.setUint32(0, buffer.byteLength, true);
            var data = new Uint8Array(this.areas[i].getRaw());
            view = new Uint8Array(buffer.byteLength + data.length);
            view.set(new Uint8Array(buffer));
            view.set(data, buffer.byteLength);
            buffer = view.buffer;
        }
    }
    return buffer;
}

rEmSetList.prototype.loadFile = function () {
    document.getElementById("quest_data").className = "hidden";
    document.getElementById("gui_message").className = "hidden";
    document.getElementById("set_em_main").className = "hidden";
    document.getElementById("em_set_list").className = "hidden";
    document.getElementById("rem").className = "hidden";
    document.getElementById("supply_list").className = "hidden";
    for (var i = 0; i < 20; i++) {
        this.areas[i].loadFile();
    }
    document.getElementById("em_set_list").removeAttribute("class");
}

var rEmSetData = function (raw_data, raw_offset, area_index) {
    this.area_index = area_index;
    this.spawns = [];
    if (raw_data == null) {
        return;
    }
    var view = new DataView(raw_data, raw_offset);
    var magic = view.getUint32(0, true);
    var version = view.getUint32(4, true);
    var count = view.getUint32(8, true);
    if (magic != 0x445345) {
        return; // error: invalid magic
    }
    if (version != 0x20140630) {
        return; // error: invalid version
    }
    for (var i = 0; i < count; i++) {
        var offset = i * 0x28 + 12 + raw_offset;
        this.spawns.push(raw_data.slice(offset, offset + 0x28));
    }
}

rEmSetData.prototype.getRaw = function () {
    var buffer = new ArrayBuffer(0xc + this.spawns.length * 0x28);
    var view = new DataView(buffer);
    view.setUint32(0, 0x445345, true);
    view.setUint32(4, 0x20140630, true);
    view.setUint32(8, this.spawns.length, true);
    for (var i = 0; i < this.spawns.length; i++) {
        view = new Uint8Array(buffer, 0xc + i * 0x28);
        view.set(new Uint8Array(this.spawns[i]));
    }
    return buffer;
}

rEmSetData.prototype.loadFile = function () {
    var table_body = document.getElementById("em_set_list").getElementsByTagName("tbody")[this.area_index];
    while (table_body.firstElementChild) {
        table_body.removeChild(table_body.firstElementChild);
    }
    for (var i = 0; i < this.spawns.length; i++) {
        var new_row = table_body.appendChild(document.createElement("tr"));
        var new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("select"));
        fillSelect(new_element, monster_list);
        linkInput(new_element, "int", this.spawns[i], 0);
        new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("input"));
        new_element.type = "text";
        linkInput(new_element, "hex", this.spawns[i], 4, 36);
        new_element = new_row.appendChild(document.createElement("td")).appendChild(document.createElement("input"));
        new_element.type = "button";
        new_element.value = " - ";
        new_element.onclick = function (event) {
            var rows = document.getElementById("em_set_list").getElementsByTagName("tbody")[this.area_index].getElementsByTagName("tr");
            var current_row = event.currentTarget.parentElement.parentElement;
            for (var i = 0; i < rows.length; i++) {
                if (rows[i] === current_row) {
                    this.spawns.splice(i, 1);
                    this.loadFile();
                    break;
                }
            }
        }.bind(this);
    }
    var table_footer = document.getElementById("em_set_list").getElementsByTagName("tfoot")[this.area_index];
    table_footer.getElementsByTagName("input")[0].onclick = function (event) {
        this.spawns.push(new ArrayBuffer(0x28));
        this.loadFile();
    }.bind(this);
}

var rRem = function (raw_data, file_name) {
    this.file_name = file_name;
    this.rewards = [];
    if (raw_data == null) {
        this.rewards.push(new ArrayBuffer(0xb0));
        return;
    }
    var view = new DataView(raw_data);
    var magic = view.getUint32(0, true);
    var count = view.getUint32(4, true);
    if (magic != 0x3f800000) {
        return; // error: invalid magic
    }
    for (var i = 0; i < count; i++) {
        var offset = i * 0xb0 + 8;
        this.rewards.push(raw_data.slice(offset, offset + 0xb0));
    }
}

rRem.prototype.file_type = 0x5b3c302d;

rRem.prototype.getRaw = function () {
    var buffer = new ArrayBuffer(8 + this.rewards.length * 0xb0);
    var view = new DataView(buffer);
    view.setUint32(0, 0x3f800000, true);
    view.setUint32(4, this.rewards.length, true);
    for (var i = 0; i < this.rewards.length; i++) {
        view = new Uint8Array(buffer, 8 + i * 0xb0);
        view.set(new Uint8Array(this.rewards[i]));
    }
    return buffer;
}

rRem.prototype.loadFile = function () {
    document.getElementById("quest_data").className = "hidden";
    document.getElementById("gui_message").className = "hidden";
    document.getElementById("set_em_main").className = "hidden";
    document.getElementById("em_set_list").className = "hidden";
    document.getElementById("rem").className = "hidden";
    document.getElementById("supply_list").className = "hidden";
    var view = new Uint8Array(this.rewards[0]);
    var inputs = document.getElementById("rem").getElementsByTagName("tbody")[0].getElementsByTagName("input");
    for (var i = 0; i < 16; i++) {
        linkInput(inputs[i], "char", this.rewards[0], i);
    }
    view = new DataView(this.rewards[0]);
    var selects = document.getElementById("rem").getElementsByTagName("tbody")[1].getElementsByTagName("select");
    inputs = document.getElementById("rem").getElementsByTagName("tbody")[1].getElementsByTagName("input");
    for (var i = 0; i < 40; i++) {
        linkInput(selects[i], "short", this.rewards[0], i*4+0x10);
        linkInput(inputs[i*2], "char", this.rewards[0], i*4+0x12);
        linkInput(inputs[i*2+1], "char", this.rewards[0], i*4+0x13);
    }
    document.getElementById("rem").removeAttribute("class");
}

var rSupplyList = function (raw_data, file_name) {
    this.file_name = file_name;
    this.supplies = [];
    if (raw_data == null) {
        this.supplies.push(new ArrayBuffer(0xa0));
        return;
    }
    var view = new DataView(raw_data);
    var magic = view.getUint32(0, true);
    var count = view.getUint32(4, true);
    if (magic != 0x3f800000) {
        return; // error: invalid magic
    }
    for (var i = 0; i < count; i++) {
        var offset = i * 0xa0 + 8;
        this.supplies.push(raw_data.slice(offset, offset + 0xa0));
    }
}

rSupplyList.prototype.file_type = 0x54539aee;

rSupplyList.prototype.getRaw = function () {
    var buffer = new ArrayBuffer(8 + this.supplies.length * 0xa0);
    var view = new DataView(buffer);
    view.setUint32(0, 0x3f800000, true);
    view.setUint32(4, this.supplies.length, true);
    for (var i = 0; i < this.supplies.length; i++) {
        view = new Uint8Array(buffer, 8 + i * 0xa0);
        view.set(new Uint8Array(this.supplies[i]));
    }
    return buffer;
}

rSupplyList.prototype.loadFile = function () {
    document.getElementById("quest_data").className = "hidden";
    document.getElementById("gui_message").className = "hidden";
    document.getElementById("set_em_main").className = "hidden";
    document.getElementById("em_set_list").className = "hidden";
    document.getElementById("rem").className = "hidden";
    document.getElementById("supply_list").className = "hidden";
    var selects = document.getElementById("supply_list").getElementsByTagName("tbody")[0].getElementsByTagName("select");
    var inputs = document.getElementById("supply_list").getElementsByTagName("tbody")[0].getElementsByTagName("input");
    for (var i = 0; i < 40; i++) {
        linkInput(selects[i], "short", this.supplies[0], i*4);
        linkInput(inputs[i*2], "char", this.supplies[0], i*4+2);
        linkInput(inputs[i*2+1], "char", this.supplies[0], i*4+3);
    }
    document.getElementById("supply_list").removeAttribute("class");
}

var archive = null;

window.onload = function () {
    document.getElementById("new").onclick = function (event) {
        archive = new rArchive(null);
        archive.loadFile();
        document.getElementById("save").removeAttribute("disabled");
    };
    document.getElementById("open").onchange = function (event) {
        var file = new FileReader();
        file.onload = function (event) {
            archive = new rArchive(this.result);
            archive.loadFile();
            document.getElementById("save").removeAttribute("disabled");
        };
        file.readAsArrayBuffer(this.files[0]);
    };
    document.getElementById("save").onclick = function (event) {
        if (archive !== null) {
            saveAs(new Blob([archive.getRaw()], {"type": "application/octet-stream"}), "output.arc");
        }
    };
    document.getElementById("add").onclick = function (event) {
        archive.addFile(document.getElementById("file_type").value);
    };
    fillSelect(document.getElementById("file_type"), file_type_list);
    fillSelect(document.getElementById("mQuestNo"), quest_id_list);
    fillSelect(document.getElementById("mQuestType"), quest_type_list);
    fillSelect(document.getElementById("mRequestVillage"), village_list);
    fillSelect(document.getElementById("mQuestLv"), quest_level_list);
    fillSelect(document.getElementById("mMonsterLv"), monster_level_list);
    fillSelect(document.getElementById("mMapNo"), map_list);
    fillSelect(document.getElementById("mStartType"), start_type_list);
    fillSelect(document.getElementById("mEntryType_1"), entry_type_list);
    fillSelect(document.getElementById("mEntryType_2"), entry_type_list);
    fillSelect(document.getElementById("mIsClearParam_1"), clear_type_list);
    linkObjective(document.getElementById("mIsClearParam_1"), document.getElementById("mClearID_1"));
    fillSelect(document.getElementById("mClearParam_2"), clear_type_list);
    linkObjective(document.getElementById("mClearParam_2"), document.getElementById("mClearID_2"));
    fillSelect(document.getElementById("mSubClearType"), clear_type_list);
    linkObjective(document.getElementById("mSubClearType"), document.getElementById("mClearID_Sub"));
    fillSelect(document.getElementById("mSuppType_1"), condition_type_list);
    linkCondition(document.getElementById("mSuppType_1"), document.getElementById("mSuppTarget_1"));
    fillSelect(document.getElementById("mSuppType_2"), condition_type_list);
    linkCondition(document.getElementById("mSuppType_2"), document.getElementById("mSuppTarget_2"));
    fillSelect(document.getElementById("mEmSetType_2"), condition_type_list);
    linkCondition(document.getElementById("mEmSetType_2"), document.getElementById("mEmSetTargetID_2"));
    fillSelect(document.getElementById("mEmSetType_3"), condition_type_list);
    linkCondition(document.getElementById("mEmSetType_3"), document.getElementById("mEmSetTargetID_3"));
    fillSelect(document.getElementById("mAppearType_1"), condition_type_list);
    linkCondition(document.getElementById("mAppearType_1"), document.getElementById("mAppearTargetType_1"));
    fillSelect(document.getElementById("mAppearType_2"), condition_type_list);
    linkCondition(document.getElementById("mAppearType_2"), document.getElementById("mAppearTargetType_2"));
    fillSelect(document.getElementById("mEmType_1"), monster_list);
    fillSelect(document.getElementById("mEmType_2"), monster_list);
    fillSelect(document.getElementById("mEmType_3"), monster_list);
    fillSelect(document.getElementById("mEmType_4"), monster_list);
    fillSelect(document.getElementById("mEmType_5"), monster_list);
    fillSelect(document.getElementById("mIcon_1"), icon_list);
    fillSelect(document.getElementById("mIcon_2"), icon_list);
    fillSelect(document.getElementById("mIcon_3"), icon_list);
    fillSelect(document.getElementById("mIcon_4"), icon_list);
    fillSelect(document.getElementById("mIcon_5"), icon_list);
    fillSelect(document.getElementById("mMessage_type"), file_type_list);
    fillSelect(document.getElementById("mBossSetRes_1_type"), file_type_list);
    fillSelect(document.getElementById("mBossSetRes_2_type"), file_type_list);
    fillSelect(document.getElementById("mBossSetRes_3_type"), file_type_list);
    fillSelect(document.getElementById("mBossSetRes_4_type"), file_type_list);
    fillSelect(document.getElementById("mBossSetRes_5_type"), file_type_list);
    fillSelect(document.getElementById("mEmSetListRes_1_type"), file_type_list);
    fillSelect(document.getElementById("mEmSetListRes_2_type"), file_type_list);
    fillSelect(document.getElementById("mEmSetListRes_3_type"), file_type_list);
    fillSelect(document.getElementById("mRemTbl_1_type"), file_type_list);
    fillSelect(document.getElementById("mRemTbl_2_type"), file_type_list);
    fillSelect(document.getElementById("mRemTbl_Add1_type"), file_type_list);
    fillSelect(document.getElementById("mRemTbl_Add2_type"), file_type_list);
    fillSelect(document.getElementById("mRemTbl_Sub_type"), file_type_list);
    fillSelect(document.getElementById("mSuppTbl_type"), file_type_list);
    var selects = document.getElementById("rem").getElementsByTagName("tbody")[1].getElementsByTagName("select");
    var template = selects[0];
    fillSelect(template, item_list);
    for (var i = 1; i < selects.length; i++) {
        selects[i].parentElement.replaceChild(template.cloneNode(true), selects[i]);
    }
    selects = document.getElementById("supply_list").getElementsByTagName("tbody")[0].getElementsByTagName("select");
    for (var i = 0; i < selects.length; i++) {
        selects[i].parentElement.replaceChild(template.cloneNode(true), selects[i]);
    }
}

