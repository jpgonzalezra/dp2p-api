import { BigInt } from "@graphprotocol/graph-ts";
import {
  Cancel,
  CreateAndDeposit,
  DisputeResolved,
  EscrowComplete,
  NewAgent,
  ReleaseWithSellerSignature,
  RemoveAgent,
} from "../generated/DP2P/DP2P";
import { Escrow, Karma, Person, Agent } from "../generated/schema";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const ZERO = BigInt.fromI32(0);
export const ONE = BigInt.fromI32(1);

export function handleCreateAndDepositEscrow(event: CreateAndDeposit): void {
  let params = event.params;
  let escrow = new Escrow(params._id.toHex());

  const seller = params._seller.toHex();
  const buyer = params._buyer.toHex();
  loadOrCreatePerson(seller);
  loadOrCreatePerson(buyer);

  escrow.agent = params._agent.toHex();
  escrow.seller = seller;
  escrow.buyer = buyer;
  escrow.token = params._token;
  escrow.balance = params._balance;

  if (params._buyer.toHex() != ZERO_ADDRESS) {
    escrow.currentState = "READY_TO_RELEASE";
  } else {
    escrow.currentState = "WAITING_BUYER";
  }

  escrow.save();
}

export function handleRelease(event: ReleaseWithSellerSignature): void {
  let params = event.params;
  let escrow = Escrow.load(event.params._id.toHex());

  createOrUpdateKarma(params._sender.toHex(), ONE, ZERO);
  createOrUpdateKarma(params._to.toHex(), ONE, ZERO);

  escrow.balance = ZERO;
  escrow.currentState = "RELEASE";
  escrow.save();
}

export function handleDisputeResolved(event: DisputeResolved): void {
  let escrow = Escrow.load(event.params._id.toHex());

  escrow.balance = ZERO;
  escrow.currentState = "RELEASE_WITH_AGENT_SIGNATURE";
  escrow.type = event.params._type;

  if (event.params._type == null) {
    escrow.save();
    return;
  }

  if (event.params._type == true) {
    // seller
    createOrUpdateKarma(escrow.seller, ONE, ZERO);
    createOrUpdateKarma(escrow.buyer, ZERO, ONE);
  } else {
    // buyer
    createOrUpdateKarma(escrow.seller, ZERO, ONE);
    createOrUpdateKarma(escrow.buyer, ONE, ZERO);
  }
  escrow.save();
}

export function handleEscrowComplete(event: EscrowComplete): void {
  let escrow = Escrow.load(event.params._id.toHex());
  escrow.currentState = "ESCROW_COMPLETE";
  escrow.buyer = event.params._buyer.toHex();
  escrow.save();
}

export function handleCancel(event: Cancel): void {
  let escrow = Escrow.load(event.params._id.toHex());
  escrow.currentState = "CANCEL";
  escrow.balance = escrow.balance.minus(event.params._amount);
  escrow.save();
}

export function handlerNewAgent(event: NewAgent): void {
  const agentAddress = event.params._agent.toHex();
  let agent = Agent.load(agentAddress);
  if (agent == null) {
    agent = new Agent(agentAddress);
    agent.fee = event.params._fee;
    agent.active = true;
  }
  agent.save();
}

export function handlerRemoveAgent(event: RemoveAgent): void {
  let agent = Agent.load(event.params._agent.toHex());
  agent.active = false;
  agent.fee = null;
}

function createOrUpdateKarma(sender: string, good: BigInt, bad: BigInt): void {
  let _sender = sender;
  if (sender == ZERO_ADDRESS) {
    return;
  }
  let karma = Karma.load(_sender);
  if (karma == null) {
    karma = new Karma(_sender);
    karma.good = ZERO;
    karma.bad = ZERO;
  }

  karma.good = karma.good.plus(good);
  karma.bad = karma.bad.plus(bad);
  karma.save();
}

function loadOrCreatePerson(sender: string): void {
  let person = Person.load(sender);
  if (person == null) {
    person = new Person(sender);
  }

  person.karma = sender;
  person.save();
}
